/* eslint-disable @typescript-eslint/camelcase */
import { TOKEN_USAGE, TokenDocument, Tokens } from "../models/Tokens";
import { SecretSwapPairs, Token } from "../models/SecretSwapPair";
import { ClientSession } from "mongodb";
import { CosmWasmClient } from "secretjs";
import config from "../util/config";
import { Pairing } from "../models/Pairing";

export interface TokenInfoResponse {
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
    const existingTokens = (await Tokens.find().lean()).filter(token => !!token.display_props).map(token => token.address);

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
        // if (existingTokens.includes(tokenAddress)) {
        //     console.log("Skipping token", tokenAddress);
        //     continue;
        // }

        console.log("Updating token", tokenAddress);


        // Query token info
        const { token_info }: TokenInfoResponse = await queryClient.queryContractSmart(tokenAddress, { token_info: {}});
        // console.log("Token Info", token_info);

        let symbol = token_info.symbol;
        if (symbol.startsWith("s") && !symbol.startsWith("stkd")) symbol = symbol.substring(1);
        if (symbol.endsWith("(BSC)")) symbol = symbol.substring(1);
        if (symbol.startsWith("S") && token_info.name !== "Secret Finance" && symbol !== "SIENNA" && symbol !== "SSCRT") symbol = symbol.substring(1);
        const newToken = {
            name: token_info.name,
            address: tokenAddress,
            decimals: token_info.decimals,
            id: tokenAddress, // ?
            price: "0",
            symbol: symbol,
            usage: ["BRIDGE", "REWARDS", "SWAP"] as TOKEN_USAGE[],
            hidden: false,
            display_props: { 
                symbol: symbol,
                label: symbol,
                hidden: false
            },
        };
        // console.log(newToken);

        await Tokens.findOneAndReplace(
            {
                address: tokenAddress
            },
            newToken,
            {
                upsert: true,
                new: true,
            }
        );

        const newPairing = {
            src_network: "secret",
            src_coin: symbol,
            src_address: tokenAddress,
            dst_network: "secret",
            dst_coin: symbol,
            dst_address: tokenAddress,
            name: token_info.name,
            symbol: symbol,
            decimals: token_info.decimals,
            price: "0",
            totalLocked: "0",
            totalLockedNormal: "0",
            totalLockedUSD: "0",
            display_props: { 
                symbol: symbol,
                label: symbol,
                hidden: false,
                usage: ["LPSTAKING", "REWARDS", "SWAP"],
            },
        };
        await Pairing.findOneAndReplace(
            {
                dst_address: newPairing.dst_address,
            },
            newPairing,
            {
                upsert: true,
            }
        );
    }


    // Add LP tokens?
    for (const pair of pairs) {
        const lpToken = pair.liquidity_token;
        if (existingTokens.includes(lpToken)) {
            console.log("Skipping LP token", lpToken);
            continue;
        }

        console.log("Updating LP token", lpToken);


        // Query token info
        const { token_info }: TokenInfoResponse = await queryClient.queryContractSmart(lpToken, { token_info: {}});
        // console.log("LP Token Info", token_info);

        const asset1Address = (pair.asset_infos[0] as Token).token?.contract_addr;
        const asset2Address = (pair.asset_infos[1] as Token).token?.contract_addr;

        const asset1 = await Tokens.findOne({ address: asset1Address }).lean();
        const asset2 = await Tokens.findOne({ address: asset2Address }).lean();

        if (!asset1Address || !asset2Address) {
            console.error(`Pair ${pair.contract_addr} is missing one or more asset addresses`);
            continue;
        }

        const symbol = `LP-${asset1.display_props.symbol}-${asset2.display_props.symbol}`;
        const newToken = {
            name: token_info.name,
            address: lpToken,
            decimals: token_info.decimals,
            id: lpToken, // ?
            price: "0",
            symbol: symbol,
            usage: ["LPSTAKING"] as TOKEN_USAGE[],
            hidden: false,
            display_props: { 
                symbol: symbol,
                label: symbol,
                hidden: false
            },
        };

        await Tokens.findOneAndReplace(
            {
                address: lpToken
            },
            {
                ...newToken
            },
            {
                upsert: true,
                new: true
            }
        );
    }

    
    console.log("Done updating tokens!");
};

export default updateTokens;