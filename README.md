# Weather MCP

A simple yet powerful weather information tool using the Model Context Protocol (MCP) and Weatherstack API.

## 📋 Quick Start for Users

### Install from npm

```bash
# Install globally to use as a command-line tool
npm install -g weather-mcp

# Get weather for any city
weather-mcp "New York"
```

### Use in Your Project

```bash
# Install as a dependency
npm install weather-mcp
```

```javascript
// Use in your code
const weatherMcp = require('weather-mcp');

// Get weather data for a city
weatherMcp.getWeatherForCity('Tokyo')
  .then(data => console.log(data))
  .catch(err => console.error('Weather not available'));

// Or start as an MCP server
const server = weatherMcp.startServer(3000);
```

## 🔌 MCP Server Registration

To register this MCP server with MCP clients, add the following configuration to your MCP client settings:

```json
{
  "mcpServers": {
    "weatherData": {
      "command": "npx",
      "args": ["-y", "weather-mcp"]
    }
  }
}
```

For Claude users, you can add this to the `.claude.json` configuration:

```json
{
  "mcpServers": {
    "weatherData": {
      "command": "npx",
      "args": ["-y", "weather-mcp"]
    }
  }
}
```

If you've installed the package globally, you can use:

```json
{
  "mcpServers": {
    "weatherData": {
      "command": "weather-mcp"
    }
  }
}
```

## 🔑 Weatherstack API Key Configuration

This package requires a Weatherstack API key to fetch weather data. Here's how to get and configure it:

### Getting an API Key

1. Visit [Weatherstack.com](https://weatherstack.com/) and sign up for a free or paid account
2. After signup, you'll get an API access key from your account dashboard
3. The free plan allows 1000 API calls per month, which is sufficient for most personal use

### Setting Your API Key

You have several options to configure your API key:

#### For Command Line Usage

```bash
# Set it just for the current session
export WEATHERSTACK_API_KEY="your_api_key_here"
weather-mcp "London"

# Or add it to your .bashrc/.zshrc for permanent configuration
echo 'export WEATHERSTACK_API_KEY="your_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

#### In JavaScript Code

```javascript
// Set it directly in your code
process.env.WEATHERSTACK_API_KEY = "your_api_key_here";
const weatherMcp = require('weather-mcp');

// Or use dotenv for better management
// First, install dotenv: npm install dotenv
require('dotenv').config();  // Add this at the top of your file
// Then create a .env file with: WEATHERSTACK_API_KEY=your_api_key_here
const weatherMcp = require('weather-mcp');
```

#### For MCP Server Registration

When registering the MCP server, you can pass the API key as an environment variable:

```json
{
  "mcpServers": {
    "weatherData": {
      "command": "weather-mcp",
      "env": {
        "WEATHERSTACK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Default API Key

This package includes a default API key with limited usage for demonstration purposes. **For production use, please configure your own API key to avoid rate limiting issues.**

## 🌐 MCP Server Usage

### Start the Server

```bash
# Install and run
npm install weather-mcp
npx weather-mcp
```

The server runs at http://localhost:3000 by default.

### Send Requests

Get server capabilities:
```bash
curl http://localhost:3000/mcp
```

Get weather for a city:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "weather", 
    "operation": "currentWeather", 
    "parameters": {
      "city": "London"
    }
  }'
```

## 🧩 Advanced Usage

### As an MCP Server in Your Application

```javascript
const express = require('express');
const weatherMcp = require('weather-mcp');

const app = express();
app.use('/weather-mcp', (req, res, next) => {
  // Mount the MCP server at a specific path
  weatherMcp.startServer(app, '/weather-mcp');
});

app.listen(8080);
```

### Response Format

Successful weather requests return:

```json
{
  "result": {
    "city": "New York",
    "country": "United States of America",
    "localtime": "2025-05-11 12:00",
    "current": {
      "temperature": 22,
      "temperatureUnit": "C",
      "weather": "Sunny",
      "windSpeed": 10,
      "windDirection": "N",
      "humidity": 65,
      "feelsLike": 23,
      "visibility": 10,
      "pressure": 1013
    }
  }
}
```

If weather data is unavailable:

```json
{
  "result": {
    "status": "not available",
    "message": "Weather data is currently not available"
  }
}
```

## 📚 About MCP

This package implements the [Model Context Protocol](https://modelcontextprotocol.io/) version 0.1.0, which provides a standardized way for AI models to request information from external tools.

The MCP server provides:
- Tool discovery via GET `/mcp`
- Tool usage via POST `/mcp`
- Structured responses with a `result` field
- Standardized error handling

## 🛠️ For Developers

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/weather-mcp

# Install dependencies
cd weather-mcp
npm install

# Start the server
npm start

# Test the CLI
node src/index.js weather "London"
```

### Publishing Your Own Version

```bash
# Update package.json with your details
# Then publish to npm
npm publish
```

## 📄 License

MIT