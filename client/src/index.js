import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { Buffer } from 'buffer';
window.Buffer = Buffer;
if (typeof window.TextEncoder === 'undefined') {
  window.TextEncoder = require('util').TextEncoder;
}
if (typeof window.TextDecoder === 'undefined') {
  window.TextDecoder = require('util').TextDecoder;
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
