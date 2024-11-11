/* eslint-disable @typescript-eslint/camelcase */
import { TokenDocument, Tokens } from "../models/Tokens";
import { SecretSwapPairs } from "../models/SecretSwapPair";
import { ClientSession } from "mongodb";
import { Document, QueryOptions, Query, UpdateQuery, CallbackError, NativeError, Model, _AllowStringsForIds, LeanDocument, SaveOptions, ToObjectOptions } from "mongoose";
import { CosmWasmClient } from "secretjs";
import config from "../util/config";

interface TokenInfoResponse {
    token_info: {
        name: string;
        symbol: string;
        decimals: number;
        //Uint128
        total_supply?: string;
    };
};

const updateTokens = async () => {
    console.log("Updating tokens");

    const queryClient = new CosmWasmClient(config.secretNodeUrl);

    const pairs = await SecretSwapPairs.find().lean();
    const existingTokens = (await Tokens.find().lean()).map(token => token.address);

    const tokenAddresses: string[] = [];
    for (const pair of pairs) {
        if (!pair.asset_infos) {
            console.error("Pair is missing asset_infos:", pair);
            continue;
        }
        const asset0 = pair.asset_infos[0];
        const asset1 = pair.asset_infos[1];

        if ("token" in asset0 && !tokenAddresses.includes(asset0.token.contract_addr)) tokenAddresses.push(asset0.token.contract_addr);
        if ("token" in asset1 && !tokenAddresses.includes(asset1.token.contract_addr)) tokenAddresses.push(asset1.token.contract_addr);
    };
    console.log(`Found ${tokenAddresses.length} tokens.`);

    for (const tokenAddress of tokenAddresses) {
        if (existingTokens.includes(tokenAddress)) {
            console.log("Skipping token", tokenAddress);
            continue;
        }

        console.log("Updating token", tokenAddress);


        // Query token info
        const { token_info }: TokenInfoResponse = await queryClient.queryContractSmart(tokenAddress, { token_info: {}});
        // console.log("Token Info", token_info);

        const newToken = {
            name: token_info.name,
            address: tokenAddress,
            decimals: token_info.decimals,
            id: tokenAddress, // ?
            price: "0",
            symbol: token_info.symbol,
            // usage: undefined, // ?
            hidden: false,

            // ???
            // display_props: { 
            //     symbol: tokenInfo.symbol,
            //     label: tokenInfo.symbol,
            // },
        };
        // console.log(newToken);

        await Tokens.create(newToken);
    }

    
    console.log("Done updating tokens!");
};

export default updateTokens;