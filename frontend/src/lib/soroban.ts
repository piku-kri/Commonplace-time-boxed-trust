import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  LIBRARY_REGISTRY_CONTRACT_ID,
  STEWARD_REPUTATION_CONTRACT_ID,
} from "./config";
import { signTransactionXdr } from "./wallet";
import { BookListing, BookBox, StewardStats, ContractCallError, ListingStatus } from "./types";

function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}

async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourcePublicKey: string
): Promise<{ result: unknown; txHash: string }> {
  const server = getServer();

  let account;
  try {
    account = await server.getAccount(sourcePublicKey);
  } catch (err) {
    throw new ContractCallError(
      "We couldn't find your account on the network. Make sure your wallet is funded on testnet.",
      err
    );
  }

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  let simulated;
  try {
    simulated = await server.simulateTransaction(tx);
  } catch (err) {
    throw new ContractCallError(
      "The network couldn't simulate this action. It may be temporarily unreachable.",
      err
    );
  }

  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new ContractCallError(readableSimulationError(simulated.error, method), simulated.error);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simulated).build();

  let signedXdr: string;
  try {
    signedXdr = await signTransactionXdr(prepared.toXDR());
  } catch (err) {
    throw new ContractCallError("Signing was cancelled or the wallet rejected the request.", err);
  }

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  let sendResponse;
  try {
    sendResponse = await server.sendTransaction(signedTx);
  } catch (err) {
    throw new ContractCallError("Failed to submit the transaction to the network.", err);
  }

  if (sendResponse.status === "ERROR") {
    throw new ContractCallError(
      "The network rejected this transaction before it could run.",
      sendResponse
    );
  }

  const txHash = sendResponse.hash;
  const finalStatus = await pollForConfirmation(server, txHash);

  if (finalStatus.status !== "SUCCESS") {
    throw new ContractCallError(
      `The transaction did not complete successfully (status: ${finalStatus.status}).`,
      finalStatus
    );
  }

  const returnValue =
    finalStatus.status === "SUCCESS" && "returnValue" in finalStatus
      ? scValToNative(finalStatus.returnValue!)
      : null;

  return { result: returnValue, txHash };
}

async function pollForConfirmation(
  server: SorobanRpc.Server,
  hash: string,
  attempts = 15,
  delayMs = 1500
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  for (let i = 0; i < attempts; i++) {
    const response = await server.getTransaction(hash);
    if (response.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new ContractCallError(
    "Timed out waiting for confirmation. Check the explorer link for final status."
  );
}

function readableSimulationError(error: string, method: string): string {
  if (error.includes("InvalidState") || error.includes("#5")) {
    return "This book isn't in a state that allows that action right now — it may already be borrowed or settled.";
  }
  if (error.includes("Unauthorized") || error.includes("#6")) {
    return "Only the borrower who took this book can return it.";
  }
  if (error.includes("InvalidDeposit") || error.includes("#7")) {
    return "Deposit must be greater than zero.";
  }
  if (error.includes("GracePeriodNotExpired") || error.includes("#8")) {
    return "The grace period hasn't elapsed yet — the borrower still has time to return this.";
  }
  if (error.includes("InvalidGracePeriod") || error.includes("#9")) {
    return "Grace period must be at least an hour.";
  }
  if (error.includes("BoxNotFound") || error.includes("ListingNotFound")) {
    return "That box or listing could not be found.";
  }
  return `The ${method.replace(/_/g, " ")} action could not be completed. ${error.slice(0, 140)}`;
}

async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<unknown> {
  const server = getServer();
  const dummySource = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const account = await server
    .getAccount(dummySource)
    .catch(async () => new (await import("@stellar/stellar-sdk")).Account(dummySource, "0"));

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new ContractCallError(`Could not read ${method} from the contract.`, simulated.error);
  }
  if (!simulated.result) return null;
  return scValToNative(simulated.result.retval);
}

// ---------- LibraryRegistry read/write helpers ----------

export async function registerBox(
  stewardAddress: string,
  name: string,
  neighborhood: string
): Promise<string> {
  const args = [
    new Address(stewardAddress).toScVal(),
    nativeToScVal(name, { type: "string" }),
    nativeToScVal(neighborhood, { type: "string" }),
  ];
  const { txHash } = await invokeContract(
    LIBRARY_REGISTRY_CONTRACT_ID,
    "register_box",
    args,
    stewardAddress
  );
  return txHash;
}

export async function listBook(
  listerAddress: string,
  boxId: number,
  title: string,
  conditionNote: string,
  depositStroops: bigint,
  gracePeriodSecs: number
): Promise<string> {
  const args = [
    new Address(listerAddress).toScVal(),
    nativeToScVal(boxId, { type: "u32" }),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(conditionNote, { type: "string" }),
    nativeToScVal(depositStroops, { type: "i128" }),
    nativeToScVal(gracePeriodSecs, { type: "u64" }),
  ];
  const { txHash } = await invokeContract(
    LIBRARY_REGISTRY_CONTRACT_ID,
    "list_book",
    args,
    listerAddress
  );
  return txHash;
}

export async function borrowBook(listingId: number, borrowerAddress: string): Promise<string> {
  const args = [
    nativeToScVal(listingId, { type: "u32" }),
    new Address(borrowerAddress).toScVal(),
  ];
  const { txHash } = await invokeContract(
    LIBRARY_REGISTRY_CONTRACT_ID,
    "borrow_book",
    args,
    borrowerAddress
  );
  return txHash;
}

export async function returnBook(listingId: number, borrowerAddress: string): Promise<string> {
  const args = [
    nativeToScVal(listingId, { type: "u32" }),
    new Address(borrowerAddress).toScVal(),
  ];
  const { txHash } = await invokeContract(
    LIBRARY_REGISTRY_CONTRACT_ID,
    "return_book",
    args,
    borrowerAddress
  );
  return txHash;
}

export async function expireLoan(listingId: number, callerAddress: string): Promise<string> {
  const args = [nativeToScVal(listingId, { type: "u32" })];
  const { txHash } = await invokeContract(
    LIBRARY_REGISTRY_CONTRACT_ID,
    "expire_loan",
    args,
    callerAddress
  );
  return txHash;
}

export async function listListings(offset: number, limit: number): Promise<BookListing[]> {
  const args = [nativeToScVal(offset, { type: "u32" }), nativeToScVal(limit, { type: "u32" })];
  const raw = (await readContract(LIBRARY_REGISTRY_CONTRACT_ID, "list_listings", args)) as any[];
  if (!raw) return [];
  return raw.map(mapRawListing);
}

export async function listBoxes(offset: number, limit: number): Promise<BookBox[]> {
  const args = [nativeToScVal(offset, { type: "u32" }), nativeToScVal(limit, { type: "u32" })];
  const raw = (await readContract(LIBRARY_REGISTRY_CONTRACT_ID, "list_boxes", args)) as any[];
  if (!raw) return [];
  return raw.map(mapRawBox);
}

export async function getStewardStats(address: string): Promise<StewardStats> {
  const args = [new Address(address).toScVal()];
  const raw = (await readContract(STEWARD_REPUTATION_CONTRACT_ID, "get_stats", args)) as any;
  const label = (await readContract(
    STEWARD_REPUTATION_CONTRACT_ID,
    "steward_label",
    args
  )) as string;
  return {
    cyclesCompleted: Number(raw.cycles_completed ?? 0),
    cyclesLapsed: Number(raw.cycles_lapsed ?? 0),
    trustScore: Number(raw.trust_score ?? 500),
    depositsReturned: String(raw.deposits_returned ?? "0"),
    label: (label as StewardStats["label"]) ?? "Regular",
  };
}

function mapRawListing(raw: any): BookListing {
  return {
    id: Number(raw.id),
    boxId: Number(raw.box_id),
    title: raw.title,
    conditionNote: raw.condition_note,
    lister: raw.lister,
    borrower: raw.borrower ?? null,
    deposit: String(raw.deposit),
    status: mapEnum(raw.status) as ListingStatus,
    listedAt: Number(raw.listed_at),
    borrowedAt: Number(raw.borrowed_at),
    gracePeriodSecs: Number(raw.grace_period_secs),
  };
}

function mapRawBox(raw: any): BookBox {
  return {
    id: Number(raw.id),
    name: raw.name,
    neighborhood: raw.neighborhood,
    steward: raw.steward,
    communityFund: String(raw.community_fund),
  };
}

function mapEnum(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    return Object.keys(raw as object)[0] ?? "Available";
  }
  return "Available";
}
