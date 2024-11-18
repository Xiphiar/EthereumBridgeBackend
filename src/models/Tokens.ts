/* eslint-disable @typescript-eslint/camelcase */
import mongoose from "mongoose";

export type TOKEN_USAGE = "BRIDGE" | "REWARDS" | "LPSTAKING" | "SWAP";

export type DisplayProps = {
    symbol: string;
    label: string;
    hidden: boolean;
}


export interface TokenDocument extends mongoose.Document {
    name: string;
    address: string;
    decimals: number;
    price: string;
    usage: TOKEN_USAGE[];
    id: string;
    hidden: boolean;
    display_props: DisplayProps;
}


export const tokenSchema = new mongoose.Schema({
    name: String,
    address: String,
    decimals: {
        type: Number,
        default: 6,
    },
    id: String,
    price: String,
    symbol: String,
    usage: Array,
    hidden: Boolean,
    display_props: {},
}, { collection: "secret_tokens" });

// userSchema.pre("save", function save(next) {
//     const user = this as UserDocument;
//     if (user.isModified("uid")) { return next(); }
//     user.uid = generateApiKey();
//     return next();
// });

export const Tokens = mongoose.model<TokenDocument>("secret_tokens", tokenSchema);
