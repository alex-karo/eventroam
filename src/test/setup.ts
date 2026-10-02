import { afterEach, beforeEach } from "vitest";
import { beginTestDatabase, endTestDatabase } from "@/test/database";

beforeEach(beginTestDatabase);
afterEach(endTestDatabase);
