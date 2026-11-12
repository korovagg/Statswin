import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import * as jsxRuntime from "react/jsx-runtime";

const ReactNamespace = React.default ?? React;
const ReactDOMNamespace = Object.assign({}, ReactDOMClient.default ?? ReactDOMClient);

window.React = ReactNamespace;
window.ReactDOM = ReactDOMNamespace;
window.React.jsxRuntime = jsxRuntime;