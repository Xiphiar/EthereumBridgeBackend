/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable camelcase */

import {AzureFunction, Context} from "@azure/functions";
import {MongoClient} from "mongodb";
import {CosmWasmClient, EnigmaUtils} from "secretjs";
import fetch from "node-fetch";
import dotenv from 'dotenv';
dotenv.config();

const coinGeckoApi = "https://api.coingecko.com/api/v3/simple/price?";

const futureBlock =  parseInt(process.env["futureBlock"]) || 10_000_000;
const LPPrefix = "LP-";
const MASTER_CONTRACT = process.env["masterStakingContract"] || "secret13hqxweum28nj0c53nnvrpd23ygguhteqggf852";

function getToken(tokens: any[], symbol: string) {
    return tokens.find(t => symbol.toLowerCase().includes(t.display_props.symbol.toLowerCase()));
}

function getPair(pairs: any[], liquidityToken: string) {
    return pairs.find(t => t.liquidity_token.toLowerCase().includes(liquidityToken.toLowerCase()));
}

interface Token {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
    price: number;
}

interface RewardPoolData {
    pool_address: string;
    inc_token: Token;
    rewards_token: Token;
    total_locked: string;
    pending_rewards: string;
    deadline: string;
    deprecated: boolean;
}

function queryMasterContractPendingRewards(address: string) {
    return {
        pending: { spy_addr: address, block: futureBlock }
    };
}

function queryDeadline() {
    return {
        end_height: {},
    };
}

function queryTokenInfo() {
    return {
        token_info: {}
    };
}

function queryRewardPool() {
    return {
        reward_pool_balance: {}
    };
}

function queryTotalLocked() {
    return {
        total_locked: {}
    };
}

function querySnip20Balance(address: string, key: string) {
    return {
        balance: {
            address: address,
            key: key
        }
    };
}

const getLPPrice = async (queryClient: CosmWasmClient, contractAddress: string, symbol: string, tokens: any[], pairs: any[], context?: any): Promise<string> => {
    const [prefix, s1, s2] = symbol.split("-");

    const pair = getPair(pairs, contractAddress);
    context.log(`pair: ${JSON.stringify(pair)}`);

    const address1 = pair.asset_infos[0]?.token?.contract_addr;
    const address2 = pair.asset_infos[1]?.token?.contract_addr;

    context.log(`Got symbols: ${s1} | ${s2} | ${prefix}`);
    const t1 = getToken(tokens, s1);

    let token = getToken(tokens, s2);
    if ([address1, address2].includes(t1.dst_address)) {
        token = t1;
    }

    const tokenPrice = token.price;

    context.log(`p1 (${token.name}) price: ${tokenPrice}`);

    const tokenInfo = (await queryClient.queryContractSmart(contractAddress, queryTokenInfo())).token_info;
    context.log(`total tokens: ${JSON.stringify(tokenInfo)}`);

    const tokenInfo2 = (await queryClient.queryContractSmart(token.dst_address, queryTokenInfo())).token_info;
    context.log(`total tokens: ${JSON.stringify(tokenInfo2)}`);

    const totalBalance = (await queryClient.queryContractSmart(token.dst_address, querySnip20Balance(pair.contract_addr, `${process.env["viewingKeySwapContract"]}`)));
    context.log(`total balance: ${JSON.stringify(totalBalance)}`);

    return String((Number(tokenPrice) * Number(totalBalance.balance.amount) * 2 / Number(tokenInfo.total_supply) /
        10**(tokenInfo2.decimals - tokenInfo.decimals)));
};



const getPriceForSymbol = async (queryClient: CosmWasmClient, contractAddress: string, symbol: string, tokens: any[], pairs: any[], context?: any): Promise<string> => {

    if (symbol.startsWith(LPPrefix)) {
        return await getLPPrice(queryClient, contractAddress, symbol, tokens, pairs, context);
    } else {
        const price = getToken(tokens, symbol).price;
        if (price) {
            return price;
        } else {
            // todo: fallback to try to get price from secretswap
            throw new Error(`Failed to get price for ${symbol}`);
        }
    }
};



const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    const client: MongoClient = await MongoClient.connect(`${process.env["mongodbUrl"]}`,
        { useUnifiedTopology: true, useNewUrlParser: true }).catch(
        (err: any) => {
            context.log(err);
            throw new Error("Failed to connect to database");
        }
    );
    const db = await client.db(`${process.env["mongodbName"]}`);
    const dbBsc = await client.db(`${process.env["mongodbNameBsc"]}`);

    const pools: RewardPoolData[] = await db.collection("rewards_data").find({}).toArray().catch(
        (err: any) => {
            context.log(err);
            throw new Error("Failed to get rewards from collection");
        });


    let tokens = await db.collection("token_pairing").find({}).limit(100).toArray().catch(
        (err: any) => {
            context.log(err);
            throw new Error("Failed to get tokens from collection");
        }
    );
    const bscTokens = await dbBsc.collection("token_pairing").find({}).limit(100).toArray().catch(
        (err: any) => {
            context.log(err);
            throw new Error("Failed to get tokens from collection");
        }
    );
    const secretTokens = await db.collection("secret_tokens").find({}).limit(100).toArray().catch(
        (err: any) => {
            context.log(err);
            throw new Error("Failed to get tokens from collection");
        }
    );

    tokens = tokens.concat(bscTokens);
    tokens = tokens.concat(secretTokens);

    console.log(`${JSON.stringify(tokens)}`)

    const pairs = await db.collection("secretswap_pairs").find({}).limit(1000).toArray().catch(
        (err: any) => {
            context.log(err);
            throw new Error("Failed to get tokens from collection");
        }
    );

    const seed = EnigmaUtils.GenerateNewSeed();
    const queryClient = new CosmWasmClient(`${process.env["secretNodeURL"]}`, seed);
    await Promise.all(
        pools.map(async pool => {
            const poolAddr = pool.pool_address;
            const incTokenAddr = pool.inc_token.address;

            let oldStylePool;
            try {
                await queryClient.queryContractSmart(poolAddr, queryDeadline());
                oldStylePool = true;
            } catch (e) {
                oldStylePool = false;
            }

            try {
                if (oldStylePool) {
                    
                    const rewardsBalance = await queryClient.queryContractSmart(poolAddr, queryRewardPool());
                    const incBalance = await queryClient.queryContractSmart(incTokenAddr, querySnip20Balance(poolAddr, `${process.env["viewingKey"]}`));
                    const deadline = await queryClient.queryContractSmart(poolAddr, queryDeadline());
                    let incTokenPrice;
                    try {
                        incTokenPrice = await (await fetch(coinGeckoApi + new URLSearchParams({
                            vs_currencies: "usd",
                            ids: pool.inc_token.name
                        }))).json();
                    } catch (err) {
                        context.log(`Failed to get price of ${pool.inc_token.name}: ${err}`);
                        incTokenPrice = pool.inc_token.price;
                    }
                    let rewardTokenPrice;
                    try {
                        rewardTokenPrice = await (await fetch(coinGeckoApi + new URLSearchParams({
                            vs_currencies: "usd",
                            ids: pool.rewards_token.name
                        }))).json();
                    } catch (err) {
                        context.log(`Failed to get price of ${pool.rewards_token.name}: ${err}`);
                        rewardTokenPrice = pool.rewards_token.price;
                    }

                    await db.collection("rewards_data").updateOne({ "pool_address": poolAddr },
                        {
                            $set: {
                                total_locked: incBalance.balance.amount,
                                pending_rewards: rewardsBalance.reward_pool_balance.balance,
                                deadline: deadline.end_height.height,
                                "inc_token.price": incTokenPrice[pool.inc_token.name].usd,
                                "rewards_token.price": rewardTokenPrice[pool.rewards_token.name].usd
                            }
                        });
                
                } else {
                    context.log("new style rewards token, yay!");
                    let pendingRewards;
                    let incBalance;
                    if (pool.deprecated) {
                        context.log("deprecated");
                        pendingRewards = "0";
                        incBalance = (await queryClient.queryContractSmart(incTokenAddr, querySnip20Balance(poolAddr, `${process.env["viewingKeySpy"]}`))).balance.amount;
                    } else {
                        context.log("not deprecated");
                        pendingRewards = (await queryClient.queryContractSmart(MASTER_CONTRACT, queryMasterContractPendingRewards(poolAddr))).pending.amount;
                        incBalance = (await queryClient.queryContractSmart(poolAddr, queryTotalLocked())).total_locked.amount;
                    }

                    context.log(`pending: ${JSON.stringify(pendingRewards)}`);
                    context.log(`inc balance: ${JSON.stringify(incBalance)}`);
                    
                    let rewardTokenPrice;
                    try {
                        rewardTokenPrice = await getPriceForSymbol(queryClient, pool.rewards_token.address, pool.rewards_token.symbol, tokens, pairs);
                        context.log(`rewards token price ${rewardTokenPrice}`);
                    } catch (err) {
                        context.log(`Failed to get price of ${pool.rewards_token.symbol}: ${err}`);
                        rewardTokenPrice = pool.rewards_token.price;
                    }
                    let incTokenPrice;
                    try {
                        incTokenPrice = await getPriceForSymbol(queryClient, incTokenAddr, pool.inc_token.symbol, tokens, pairs, context);
                    } catch (err) {
                        context.log(`Failed to get price of ${pool.inc_token.symbol}: ${err}`);
                        incTokenPrice = pool.inc_token.price;
                    }

                    context.log(`inc token price ${incTokenPrice}`);

                    await db.collection("rewards_data").updateOne({ "pool_address": poolAddr },
                        {
                            $set: {
                                total_locked: incBalance,
                                pending_rewards: pendingRewards,
                                deadline: futureBlock,
                                "inc_token.price": incTokenPrice,
                                "rewards_token.price": rewardTokenPrice
                            }
                        });
                }

            // Query chain for things needed to be updated
            } catch (err) {
                context.log(`Could not update rewards data of ${poolAddr}. Error: ${err}`);
            }
        })
    ).catch(
        err => {
            context.log(`Failed update rewards stats: ${err}`);
        }
    );
    await client.close();

};


export default timerTrigger;
timerTrigger(console as any);
