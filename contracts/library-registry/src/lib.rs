//! Library Registry Contract
//!
//! An on-chain layer for neighborhood "little free library" book boxes.
//! Anyone can register a box (a physical location). Anyone can list a
//! book available in a box. A borrower stakes a small XLM deposit to
//! take a book, has a grace period to either return it or log that
//! they left a replacement in a box, and gets their deposit back the
//! moment they do — with a cross-contract call into
//! `StewardReputation` raising their trust score. If the grace period
//! expires with no return, anyone can trigger `expire_loan`, which
//! forfeits the deposit to the box's community fund and penalizes the
//! borrower's reputation.
//!
//! State machine per book listing:
//!   Available -> Borrowed -> Returned (deposit refunded, reputation +)
//!                          -> Lapsed  (deposit forfeited, reputation -)

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    String, Symbol, Vec,
};

mod reputation {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32-unknown-unknown/release/steward_reputation.wasm"
    );
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ListingStatus {
    Available,
    Borrowed,
    Returned,
    Lapsed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BookListing {
    pub id: u32,
    pub box_id: u32,
    pub title: String,
    pub condition_note: String,
    pub lister: Address,
    pub borrower: Option<Address>,
    pub deposit: i128,
    pub status: ListingStatus,
    pub listed_at: u64,
    pub borrowed_at: u64,
    pub grace_period_secs: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BookBox {
    pub id: u32,
    pub name: String,
    pub neighborhood: String,
    pub steward: Address,
    pub community_fund: i128,
}

#[contracttype]
enum DataKey {
    Admin,
    TokenAddress,
    ReputationAddress,
    BoxCount,
    Box(u32),
    ListingCount,
    Listing(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum RegistryError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    BoxNotFound = 3,
    ListingNotFound = 4,
    InvalidState = 5,
    Unauthorized = 6,
    InvalidDeposit = 7,
    GracePeriodNotExpired = 8,
    InvalidGracePeriod = 9,
}

const MIN_GRACE_PERIOD_SECS: u64 = 3600; // 1 hour minimum, prevents griefing with 0-second loans

#[contracttype]
pub struct BoxRegisteredEvent {
    pub box_id: u32,
    pub steward: Address,
}

#[contracttype]
pub struct BookListedEvent {
    pub listing_id: u32,
    pub box_id: u32,
    pub lister: Address,
    pub title: String,
}

#[contracttype]
pub struct BookBorrowedEvent {
    pub listing_id: u32,
    pub borrower: Address,
}

#[contracttype]
pub struct BookReturnedEvent {
    pub listing_id: u32,
    pub borrower: Address,
    pub deposit_refunded: i128,
}

#[contracttype]
pub struct LoanLapsedEvent {
    pub listing_id: u32,
    pub borrower: Address,
}

#[contract]
pub struct LibraryRegistry;

#[contractimpl]
impl LibraryRegistry {
    pub fn initialize(
        env: Env,
        admin: Address,
        token_address: Address,
        reputation_address: Address,
    ) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenAddress, &token_address);
        env.storage()
            .instance()
            .set(&DataKey::ReputationAddress, &reputation_address);
        env.storage().instance().set(&DataKey::BoxCount, &0u32);
        env.storage().instance().set(&DataKey::ListingCount, &0u32);
        Ok(())
    }

    /// Anyone can register a physical book box location and become its steward.
    pub fn register_box(
        env: Env,
        steward: Address,
        name: String,
        neighborhood: String,
    ) -> Result<u32, RegistryError> {
        steward.require_auth();

        let id: u32 = env.storage().instance().get(&DataKey::BoxCount).unwrap_or(0);
        let book_box = BookBox {
            id,
            name,
            neighborhood,
            steward: steward.clone(),
            community_fund: 0,
        };
        env.storage().persistent().set(&DataKey::Box(id), &book_box);
        env.storage().instance().set(&DataKey::BoxCount, &(id + 1));

        env.events().publish(
            (symbol_short!("library"), Symbol::new(&env, "box_registered")),
            BoxRegisteredEvent { box_id: id, steward }
        );
        Ok(id)
    }

    /// List a book as available in a given box.
    pub fn list_book(
        env: Env,
        lister: Address,
        box_id: u32,
        title: String,
        condition_note: String,
        deposit: i128,
        grace_period_secs: u64,
    ) -> Result<u32, RegistryError> {
        lister.require_auth();
        Self::get_box_internal(&env, box_id)?; // ensures box exists

        if deposit <= 0 {
            return Err(RegistryError::InvalidDeposit);
        }
        if grace_period_secs < MIN_GRACE_PERIOD_SECS {
            return Err(RegistryError::InvalidGracePeriod);
        }

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ListingCount)
            .unwrap_or(0);

        let listing = BookListing {
            id,
            box_id,
            title: title.clone(),
            condition_note,
            lister: lister.clone(),
            borrower: None,
            deposit,
            status: ListingStatus::Available,
            listed_at: env.ledger().timestamp(),
            borrowed_at: 0,
            grace_period_secs,
        };

        env.storage().persistent().set(&DataKey::Listing(id), &listing);
        env.storage()
            .instance()
            .set(&DataKey::ListingCount, &(id + 1));

        env.events().publish(
            (symbol_short!("library"), Symbol::new(&env, "book_listed")),
            BookListedEvent {
                listing_id: id,
                box_id,
                lister,
                title,
            }
        );

        Ok(id)
    }

    /// Borrower stakes the deposit and takes the book.
    pub fn borrow_book(env: Env, listing_id: u32, borrower: Address) -> Result<(), RegistryError> {
        borrower.require_auth();
        let mut listing = Self::get_listing_internal(&env, listing_id)?;

        if listing.status != ListingStatus::Available {
            return Err(RegistryError::InvalidState);
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(RegistryError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&borrower, &env.current_contract_address(), &listing.deposit);

        listing.status = ListingStatus::Borrowed;
        listing.borrower = Some(borrower.clone());
        listing.borrowed_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);

        env.events().publish(
            (symbol_short!("library"), Symbol::new(&env, "book_borrowed")),
            BookBorrowedEvent { listing_id, borrower }
        );
        Ok(())
    }

    /// Borrower confirms they returned the book (or left a replacement)
    /// within the grace period. Deposit refunds and reputation rises
    /// via a cross-contract call.
    pub fn return_book(env: Env, listing_id: u32, borrower: Address) -> Result<(), RegistryError> {
        borrower.require_auth();
        let mut listing = Self::get_listing_internal(&env, listing_id)?;

        if listing.status != ListingStatus::Borrowed {
            return Err(RegistryError::InvalidState);
        }
        let expected_borrower = listing.borrower.clone().ok_or(RegistryError::InvalidState)?;
        if expected_borrower != borrower {
            return Err(RegistryError::Unauthorized);
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(RegistryError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &borrower, &listing.deposit);

        // --- Cross-contract call: raise borrower's trust score ---
        let reputation_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::ReputationAddress)
            .ok_or(RegistryError::NotInitialized)?;
        let reputation_client = reputation::Client::new(&env, &reputation_address);
        reputation_client.record_completion(
            &env.current_contract_address(),
            &borrower,
            &listing.deposit,
        );

        listing.status = ListingStatus::Returned;

        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);

        env.events().publish(
            (symbol_short!("library"), Symbol::new(&env, "book_returned")),
            BookReturnedEvent {
                listing_id,
                borrower,
                deposit_refunded: listing.deposit,
            }
        );

        Ok(())
    }

    /// Anyone can call this once the grace period has elapsed on a
    /// still-Borrowed listing. Forfeits the deposit into the box's
    /// community fund and penalizes the borrower's reputation.
    pub fn expire_loan(env: Env, listing_id: u32) -> Result<(), RegistryError> {
        let mut listing = Self::get_listing_internal(&env, listing_id)?;

        if listing.status != ListingStatus::Borrowed {
            return Err(RegistryError::InvalidState);
        }

        let now = env.ledger().timestamp();
        let deadline = listing.borrowed_at + listing.grace_period_secs;
        if now < deadline {
            return Err(RegistryError::GracePeriodNotExpired);
        }

        let borrower = listing.borrower.clone().ok_or(RegistryError::InvalidState)?;

        let mut book_box = Self::get_box_internal(&env, listing.box_id)?;
        book_box.community_fund += listing.deposit;
        env.storage()
            .persistent()
            .set(&DataKey::Box(listing.box_id), &book_box);

        // --- Cross-contract call: penalize borrower's trust score ---
        let reputation_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::ReputationAddress)
            .ok_or(RegistryError::NotInitialized)?;
        let reputation_client = reputation::Client::new(&env, &reputation_address);
        reputation_client.record_lapse(&env.current_contract_address(), &borrower);

        listing.status = ListingStatus::Lapsed;

        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);

        env.events().publish(
            (symbol_short!("library"), Symbol::new(&env, "loan_lapsed")),
            LoanLapsedEvent { listing_id, borrower }
        );
        Ok(())
    }

    pub fn get_listing(env: Env, listing_id: u32) -> Result<BookListing, RegistryError> {
        Self::get_listing_internal(&env, listing_id)
    }

    pub fn get_box(env: Env, box_id: u32) -> Result<BookBox, RegistryError> {
        Self::get_box_internal(&env, box_id)
    }

    pub fn list_listings(env: Env, offset: u32, limit: u32) -> Vec<BookListing> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ListingCount)
            .unwrap_or(0);
        let mut out = Vec::new(&env);
        let mut i = offset;
        let end = (offset + limit).min(count);
        while i < end {
            if let Some(l) = env.storage().persistent().get(&DataKey::Listing(i)) {
                out.push_back(l);
            }
            i += 1;
        }
        out
    }

    pub fn list_boxes(env: Env, offset: u32, limit: u32) -> Vec<BookBox> {
        let count: u32 = env.storage().instance().get(&DataKey::BoxCount).unwrap_or(0);
        let mut out = Vec::new(&env);
        let mut i = offset;
        let end = (offset + limit).min(count);
        while i < end {
            if let Some(b) = env.storage().persistent().get(&DataKey::Box(i)) {
                out.push_back(b);
            }
            i += 1;
        }
        out
    }

    pub fn listing_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::ListingCount).unwrap_or(0)
    }

    fn get_listing_internal(env: &Env, listing_id: u32) -> Result<BookListing, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .ok_or(RegistryError::ListingNotFound)
    }

    fn get_box_internal(env: &Env, box_id: u32) -> Result<BookBox, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Box(box_id))
            .ok_or(RegistryError::BoxNotFound)
    }
}

mod test;
