import knexFactory from "knex";
import knexConfig from "../knexfile.js";

export const db = knexFactory(knexConfig);
export const USE_PG = knexConfig.client === "pg";
