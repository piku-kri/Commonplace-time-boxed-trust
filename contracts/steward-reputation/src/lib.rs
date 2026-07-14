//! Steward Reputation Contract
//!
//! Tracks community trust for participants in the book exchange network.
//! Invoked cross-contract by `LibraryRegistry` whenever a borrower
//! completes a fair take-and-return cycle (raising their score) or lets
//! a loan lapse past the grace period without returning a book
//! (lowering it). A steward's score follows them across every book box
//! in the network, not just one.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StewardStats {
    pub cycles_completed: u32,
    pub cycles_lapsed: u32,
    pub trust_score: u32, // 0 - 1000
    pub deposits_returned: i128,
}

#[contracttype]
enum DataKey {
    Admin,
    Stats(Address),
    AuthorizedWriter(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum ReputationError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
}

#[contractevent(topics = ["reputation", "cycle_completed"])]
pub struct CycleCompletedEvent {
    #[topic]
    pub steward: Address,
    pub new_score: u32,
    pub deposit_returned: i128,
}

#[contractevent(topics = ["reputation", "cycle_lapsed"])]
pub struct CycleLapsedEvent {
    #[topic]
    pub steward: Address,
    pub new_score: u32,
}

#[contractevent(topics = ["registry", "writer_authorized"])]
pub struct WriterAuthorizedEvent {
    #[topic]
    pub writer: Address,
}

const STARTING_SCORE: u32 = 500;
const MAX_SCORE: u32 = 1000;
const COMPLETION_BONUS: u32 = 18;
const LAPSE_PENALTY: u32 = 70;

#[contract]
pub struct StewardReputation;

#[contractimpl]
impl StewardReputation {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ReputationError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ReputationError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn authorize_writer(env: Env, writer: Address) -> Result<(), ReputationError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ReputationError::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::AuthorizedWriter(writer.clone()), &true);

        WriterAuthorizedEvent { writer }.publish(&env);
        Ok(())
    }

    /// Called cross-contract by LibraryRegistry when a borrower returns
    /// a book (or leaves a replacement) within the grace period and
    /// their deposit is refunded.
    pub fn record_completion(
        env: Env,
        caller: Address,
        steward: Address,
        deposit_returned: i128,
    ) -> Result<StewardStats, ReputationError> {
        caller.require_auth();
        Self::assert_authorized(&env, &caller)?;

        if deposit_returned < 0 {
            return Err(ReputationError::InvalidAmount);
        }

        let mut stats = Self::get_stats_internal(&env, &steward);
        stats.cycles_completed += 1;
        stats.deposits_returned += deposit_returned;
        stats.trust_score = (stats.trust_score + COMPLETION_BONUS).min(MAX_SCORE);

        env.storage()
            .persistent()
            .set(&DataKey::Stats(steward.clone()), &stats);

        CycleCompletedEvent {
            steward,
            new_score: stats.trust_score,
            deposit_returned,
        }
        .publish(&env);

        Ok(stats)
    }

    /// Called cross-contract by LibraryRegistry when a loan lapses past
    /// the grace period without a return, forfeiting the deposit.
    pub fn record_lapse(
        env: Env,
        caller: Address,
        steward: Address,
    ) -> Result<StewardStats, ReputationError> {
        caller.require_auth();
        Self::assert_authorized(&env, &caller)?;

        let mut stats = Self::get_stats_internal(&env, &steward);
        stats.cycles_lapsed += 1;
        stats.trust_score = stats.trust_score.saturating_sub(LAPSE_PENALTY);

        env.storage()
            .persistent()
            .set(&DataKey::Stats(steward.clone()), &stats);

        CycleLapsedEvent {
            steward,
            new_score: stats.trust_score,
        }
        .publish(&env);

        Ok(stats)
    }

    pub fn get_stats(env: Env, steward: Address) -> StewardStats {
        Self::get_stats_internal(&env, &steward)
    }

    pub fn steward_label(env: Env, steward: Address) -> String {
        let stats = Self::get_stats_internal(&env, &steward);
        match stats.trust_score {
            0..=349 => String::from_str(&env, "New Reader"),
            350..=599 => String::from_str(&env, "Regular"),
            600..=849 => String::from_str(&env, "Trusted Borrower"),
            _ => String::from_str(&env, "Library Steward"),
        }
    }

    fn assert_authorized(env: &Env, caller: &Address) -> Result<(), ReputationError> {
        let is_authorized = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedWriter(caller.clone()))
            .unwrap_or(false);
        if !is_authorized {
            return Err(ReputationError::Unauthorized);
        }
        Ok(())
    }

    fn get_stats_internal(env: &Env, steward: &Address) -> StewardStats {
        env.storage()
            .persistent()
            .get(&DataKey::Stats(steward.clone()))
            .unwrap_or(StewardStats {
                cycles_completed: 0,
                cycles_lapsed: 0,
                trust_score: STARTING_SCORE,
                deposits_returned: 0,
            })
    }
}

mod test;
