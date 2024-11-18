import {Request, Response} from "express";
import { RewardsDocument, Rewards } from "../models/Rewards";

export const getRewardPools = async (req: Request, res: Response) => {
    const pools = await Rewards.find({}, {_id: false});

    try {
        res.json( { pools: pools });
    } catch (e) {
        res.status(500);
        res.send(`Error: ${e}`);
    }

};

export const getPool = async (req: Request, res: Response) => {
    const poolAddr = req.params.pool;
    // eslint-disable-next-line @typescript-eslint/camelcase
    const pool: RewardsDocument = await Rewards.findOne({pool_address: poolAddr}, {_id: false});

    if (!pool) {
        res.status(404);
    } else {
        try {
            res.json( { pool: pool });
        } catch (e) {
            res.status(500);
            res.send(`Error: ${e}`);
        }
    }
};