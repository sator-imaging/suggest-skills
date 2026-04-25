export default {
  extends: ["oxlint:recommended"],

  rules: {
    // =====================
    // 🚫 バンドル時に削除
    // =====================
    // "no-console": "error",
    // "no-debugger": "error",

    // =====================
    // 🚫 実行時バグ・事故防止
    // =====================
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-constant-condition": "error",

    // =====================
    // 🚫 JSの曖昧性排除
    // =====================
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
    "no-implicit-coercion": "error",
    "no-var": "error",
    "prefer-const": "error",
    "no-shadow": "error",

    // =====================
    // 🚫 設計ルール（軽量・重要のみ）
    // =====================
    "no-restricted-syntax": [
      "error",
      {
        selector: "TSEnumDeclaration",
        message: "enum 禁止（as const + satisfies を使う）",
      },
      {
        selector: "WithStatement",
        message: "with 禁止（スコープ汚染）",
      },
    ],

    // =====================
    // 🚫 複雑度制御（現実的ライン）
    // =====================
    // complexity: ["error", { max: 10 }],
    // "max-lines": ["error", 400],
  },
};