import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", ".expo/**"] },
  ...tseslint.configs.recommended,
);
