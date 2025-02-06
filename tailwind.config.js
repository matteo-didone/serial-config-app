module.exports = {
  content: ["./src/renderer/**/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#0284c7",
          secondary: "#0ea5e9",
          accent: "#37CDBE",
          neutral: "#3D4451",
          "base-100": "#FFFFFF",
        },
      },
      "dark"
    ],
  },
}