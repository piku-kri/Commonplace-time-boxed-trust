#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

fn setup() -> (Env, StewardReputationClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(StewardReputation, ());
    let client = StewardReputationClient::new(&env, &contract_id);
    client.initialize(&admin);

    let writer = Address::generate(&env);
    client.authorize_writer(&writer);

    (env, client, admin, writer)
}

#[test]
fn test_initialize_only_once() {
    let (env, client, _admin, _writer) = setup();
    let other = Address::generate(&env);
    assert!(client.try_initialize(&other).is_err());
}

#[test]
fn test_new_steward_starts_at_baseline() {
    let (env, client, _admin, _writer) = setup();
    let steward = Address::generate(&env);
    let stats = client.get_stats(&steward);
    assert_eq!(stats.trust_score, 500);
    assert_eq!(stats.cycles_completed, 0);
}

#[test]
fn test_record_completion_increases_score_and_deposits() {
    let (env, client, _admin, writer) = setup();
    let steward = Address::generate(&env);

    let stats = client.record_completion(&writer, &steward, &20_i128);
    assert_eq!(stats.cycles_completed, 1);
    assert_eq!(stats.deposits_returned, 20);
    assert_eq!(stats.trust_score, 518);
}

#[test]
fn test_record_completion_rejects_unauthorized_caller() {
    let (env, client, _admin, _writer) = setup();
    let steward = Address::generate(&env);
    let rogue = Address::generate(&env);
    assert!(client.try_record_completion(&rogue, &steward, &20_i128).is_err());
}

#[test]
fn test_record_completion_rejects_negative_deposit() {
    let (env, client, _admin, writer) = setup();
    let steward = Address::generate(&env);
    assert!(client.try_record_completion(&writer, &steward, &(-1_i128)).is_err());
}

#[test]
fn test_record_lapse_penalizes_score() {
    let (env, client, _admin, writer) = setup();
    let steward = Address::generate(&env);

    client.record_completion(&writer, &steward, &20_i128); // 518
    let stats = client.record_lapse(&writer, &steward);
    assert_eq!(stats.cycles_lapsed, 1);
    assert_eq!(stats.trust_score, 448); // 518 - 70
}

#[test]
fn test_score_capped_at_max() {
    let (env, client, _admin, writer) = setup();
    let steward = Address::generate(&env);
    for _ in 0..30 {
        client.record_completion(&writer, &steward, &1_i128);
    }
    assert_eq!(client.get_stats(&steward).trust_score, 1000);
}

#[test]
fn test_steward_labels_reflect_score_bands() {
    let (env, client, _admin, writer) = setup();
    let regular = Address::generate(&env);
    assert_eq!(client.steward_label(&regular), String::from_str(&env, "Regular"));

    let veteran = Address::generate(&env);
    for _ in 0..20 {
        client.record_completion(&writer, &veteran, &1_i128);
    }
    // 500 + 360 = 860 -> Library Steward
    assert_eq!(client.steward_label(&veteran), String::from_str(&env, "Library Steward"));
}
