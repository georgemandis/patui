#!/usr/bin/env bun
import { render } from "ink";
import { App } from "./App.js";

const args = process.argv.slice(2);
const source = args[0] || null;

render(<App source={source} />);
