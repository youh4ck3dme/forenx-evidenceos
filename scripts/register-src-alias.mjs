import { register } from "node:module";

// Lets `npm run test:malte` import `src/**/*.ts` and its `@/` specifiers.
register("./src-alias-loader.mjs", import.meta.url);
