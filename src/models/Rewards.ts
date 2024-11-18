/* eslint-disable @typescript-eslint/camelcase */
import mongoose from "mongoose";

export interface Token {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
    price: string;
}

export interface RewardsDocument extends mongoose.Document {
    pool_address: string;
    inc_token: Token;
    rewards_token: Token;
    total_locked: string;
    pending_rewards: string;
    deadline: string;
    deprecated?: boolean;
    deprecated_by?: string;
}

export const rewardsSchema = new mongoose.Schema({
    pool_address: String,
    contract_hash: String,
    inc_token: {
        symbol: String,
        address: String,
        decimals: Number,
        name: String,
        price: String,
    },
    rewards_token: {
        symbol: String,
        address: String,
        decimals: Number,
        name: String,
        price: String,
    },
    total_locked: String,
    pending_rewards: String,
    deadline: String,
    hidden: Boolean,
    deprecated: Boolean,
    deprecated_by: String,
}, { collection: "rewards_data" });

export const Rewards = mongoose.model<RewardsDocument>("rewards", rewardsSchema);