#!/usr/bin/env node

/**
 * CLI for weather-mcp
 * This allows users to access weather information directly from the command line
 */

const args = process.argv.slice(2);

// If no arguments are provided, show usage information
if (args.length === 0) {
  console.log("Weather MCP - A weather information tool using the Model Context Protocol");
  console.log("\nUsage:");
  console.log("  weather-mcp <city>");
  console.log("\nExamples:");
  console.log("  weather-mcp \"New York\"");
  console.log("  weather-mcp London");
  process.exit(0);
}

// Treat all arguments as the city name
const cityName = args.join(" ");

// Pass weather command to the main application with the city name
process.argv = [process.argv[0], process.argv[1], "weather", cityName];
require('../src/index.js');