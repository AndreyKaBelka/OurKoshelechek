import type { CodegenConfig } from "@graphql-codegen/cli";

// Points at the backend's schema-first GraphQL definitions directly (api/**/*.graphql),
// the same source gqlgen uses for `make generate` on the Go side. Run `npm run codegen`
// whenever an operation is added under src/**/*.graphql — it generates a colocated
// `<name>.generated.ts` next to each document with typed urql hooks.
const scalars = {
  UUID: "string",
  DateTime: "string",
};

// enumsAsTypes: GraphQL enum values (e.g. TransactionType.EXPENSE) are plain
// string unions ("EXPENSE" | "INCOME") in the generated types, so screen code
// can use string literals directly instead of importing every enum's members.
const config: CodegenConfig = {
  schema: "../api/**/*.graphql",
  generates: {
    "src/graphql/types.ts": {
      plugins: ["typescript"],
      config: { scalars, enumsAsTypes: true },
    },
    "src/graphql/": {
      preset: "near-operation-file",
      presetConfig: {
        baseTypesPath: "types.ts",
      },
      documents: ["src/**/*.graphql"],
      // near-operation-file-preset always imports the `Types` namespace, even
      // for operations with no input-typed variables (e.g. Health, Summary) —
      // `// @ts-nocheck` sidesteps the resulting noUnusedLocals error on those.
      plugins: [{ add: { content: "// @ts-nocheck" } }, "typescript-operations", "typescript-urql"],
      config: { scalars, enumsAsTypes: true },
    },
  },
};

export default config;
