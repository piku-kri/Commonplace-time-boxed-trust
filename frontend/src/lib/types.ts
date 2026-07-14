export type ListingStatus = "Available" | "Borrowed" | "Returned" | "Lapsed";

export interface BookListing {
  id: number;
  boxId: number;
  title: string;
  conditionNote: string;
  lister: string;
  borrower: string | null;
  deposit: string;
  status: ListingStatus;
  listedAt: number;
  borrowedAt: number;
  gracePeriodSecs: number;
}

export interface BookBox {
  id: number;
  name: string;
  neighborhood: string;
  steward: string;
  communityFund: string;
}

export interface StewardStats {
  cyclesCompleted: number;
  cyclesLapsed: number;
  trustScore: number;
  depositsReturned: string;
  label: "New Reader" | "Regular" | "Trusted Borrower" | "Library Steward";
}

export type ActivityEventKind =
  | "BoxRegistered"
  | "BookListed"
  | "BookBorrowed"
  | "BookReturned"
  | "LoanLapsed";

export interface ActivityEvent {
  id: string;
  kind: ActivityEventKind;
  listingId: number;
  actor: string;
  detail: string;
  timestamp: number;
  txHash?: string;
}

export class ContractCallError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContractCallError";
  }
}
