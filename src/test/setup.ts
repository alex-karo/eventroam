import { afterEach, beforeEach } from "vitest";
import { beginTestDatabase, endTestDatabase } from "./database";

beforeEach(beginTestDatabase);
afterEach(endTestDatabase);
