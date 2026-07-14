#![cfg(test)]

use super::*;
use steward_reputation::StewardReputation;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::Env;

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, token::StellarAssetClient<'a>, token::Client<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let address = sac.address();
    (
        address.clone(),
        token::StellarAssetClient::new(env, &address),
        token::Client::new(env, &address),
    )
}

struct TestSetup<'a> {
    env: Env,
    registry: LibraryRegistryClient<'a>,
    reputation: steward_reputation::StewardReputationClient<'a>,
    token: token::Client<'a>,
}

fn setup<'a>() -> TestSetup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _token_admin, token) = create_token_contract(&env, &admin);

    let reputation_id = env.register(StewardReputation, ());
    let reputation = steward_reputation::StewardReputationClient::new(&env, &reputation_id);
    reputation.initialize(&admin);

    let registry_id = env.register(LibraryRegistry, ());
    let registry = LibraryRegistryClient::new(&env, &registry_id);
    registry.initialize(&admin, &token_address, &reputation_id);

    reputation.authorize_writer(&registry_id);

    TestSetup { env, registry, reputation, token }
}

fn fund(s: &TestSetup, who: &Address, amount: i128) {
    let token_admin = token::StellarAssetClient::new(&s.env, &s.token.address);
    token_admin.mint(who, &amount);
}

#[test]
fn test_register_box() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Maple Street Box");
    let neighborhood = String::from_str(&s.env, "Riverside");

    let id = s.registry.register_box(&steward, &name, &neighborhood);
    assert_eq!(id, 0);

    let book_box = s.registry.get_box(&id);
    assert_eq!(book_box.steward, steward);
    assert_eq!(book_box.community_fund, 0);
}

#[test]
fn test_list_book_requires_existing_box() {
    let s = setup();
    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let result = s.registry.try_list_book(&lister, &99, &title, &note, &5_000_000, &7200);
    assert!(result.is_err());
}

#[test]
fn test_list_book_rejects_non_positive_deposit() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);

    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let result = s.registry.try_list_book(&lister, &box_id, &title, &note, &0, &7200);
    assert!(result.is_err());
}

#[test]
fn test_list_book_rejects_short_grace_period() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);

    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let result = s.registry.try_list_book(&lister, &box_id, &title, &note, &5_000_000, &10);
    assert!(result.is_err());
}

#[test]
fn test_full_lifecycle_borrow_return_updates_reputation() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Maple Street Box");
    let hood = String::from_str(&s.env, "Riverside");
    let box_id = s.registry.register_box(&steward, &name, &hood);

    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "The Hobbit");
    let note = String::from_str(&s.env, "Well loved paperback, all pages intact");
    let listing_id = s
        .registry
        .list_book(&lister, &box_id, &title, &note, &5_000_000, &7200);

    let borrower = Address::generate(&s.env);
    fund(&s, &borrower, 100_000_000);

    s.registry.borrow_book(&listing_id, &borrower);
    let listing = s.registry.get_listing(&listing_id);
    assert_eq!(listing.status, ListingStatus::Borrowed);
    assert_eq!(s.token.balance(&borrower), 95_000_000);

    s.registry.return_book(&listing_id, &borrower);
    let returned = s.registry.get_listing(&listing_id);
    assert_eq!(returned.status, ListingStatus::Returned);
    assert_eq!(s.token.balance(&borrower), 100_000_000);

    let stats = s.reputation.get_stats(&borrower);
    assert_eq!(stats.cycles_completed, 1);
    assert_eq!(stats.trust_score, 518);
}

#[test]
fn test_only_borrower_can_return() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);
    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let listing_id = s.registry.list_book(&lister, &box_id, &title, &note, &5_000_000, &7200);

    let borrower = Address::generate(&s.env);
    fund(&s, &borrower, 100_000_000);
    s.registry.borrow_book(&listing_id, &borrower);

    let stranger = Address::generate(&s.env);
    let result = s.registry.try_return_book(&listing_id, &stranger);
    assert!(result.is_err());
}

#[test]
fn test_expire_loan_before_grace_period_fails() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);
    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let listing_id = s.registry.list_book(&lister, &box_id, &title, &note, &5_000_000, &7200);

    let borrower = Address::generate(&s.env);
    fund(&s, &borrower, 100_000_000);
    s.registry.borrow_book(&listing_id, &borrower);

    let result = s.registry.try_expire_loan(&listing_id);
    assert!(result.is_err());
}

#[test]
fn test_expire_loan_after_grace_period_forfeits_deposit_and_penalizes() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);
    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let listing_id = s.registry.list_book(&lister, &box_id, &title, &note, &5_000_000, &7200);

    let borrower = Address::generate(&s.env);
    fund(&s, &borrower, 100_000_000);
    s.registry.borrow_book(&listing_id, &borrower);

    let balance_before = s.token.balance(&borrower);

    s.env.ledger().with_mut(|li| {
        li.timestamp += 7201;
    });

    s.registry.expire_loan(&listing_id);

    let listing = s.registry.get_listing(&listing_id);
    assert_eq!(listing.status, ListingStatus::Lapsed);
    assert_eq!(s.token.balance(&borrower), balance_before);

    let book_box = s.registry.get_box(&box_id);
    assert_eq!(book_box.community_fund, 5_000_000);

    let stats = s.reputation.get_stats(&borrower);
    assert_eq!(stats.cycles_lapsed, 1);
    assert_eq!(stats.trust_score, 430); // 500 - 70
}

#[test]
fn test_cannot_borrow_already_borrowed_book() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);
    let lister = Address::generate(&s.env);
    let title = String::from_str(&s.env, "Dune");
    let note = String::from_str(&s.env, "Good condition, some highlighting");
    let listing_id = s.registry.list_book(&lister, &box_id, &title, &note, &5_000_000, &7200);

    let borrower1 = Address::generate(&s.env);
    fund(&s, &borrower1, 100_000_000);
    s.registry.borrow_book(&listing_id, &borrower1);

    let borrower2 = Address::generate(&s.env);
    fund(&s, &borrower2, 100_000_000);
    let result = s.registry.try_borrow_book(&listing_id, &borrower2);
    assert!(result.is_err());
}

#[test]
fn test_list_listings_pagination() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let name = String::from_str(&s.env, "Box");
    let hood = String::from_str(&s.env, "Hood");
    let box_id = s.registry.register_box(&steward, &name, &hood);
    let lister = Address::generate(&s.env);

    for _ in 0..4 {
        let title = String::from_str(&s.env, "Book");
        let note = String::from_str(&s.env, "Routine listing note here");
        s.registry.list_book(&lister, &box_id, &title, &note, &1_000_000, &7200);
    }
    assert_eq!(s.registry.listing_count(), 4);
    let page = s.registry.list_listings(&0, &2);
    assert_eq!(page.len(), 2);
}

#[test]
fn test_unauthorized_writer_cannot_forge_reputation() {
    let s = setup();
    let steward = Address::generate(&s.env);
    let rogue_contract = Address::generate(&s.env);
    let result = s.reputation.try_record_completion(&rogue_contract, &steward, &10_i128);
    assert!(result.is_err());
}
