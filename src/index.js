// Weather MCP Server
// A Model Context Protocol server for weather information using the Weatherstack API
// Based on the specification: https://modelcontextprotocol.io/

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Server configuration
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for MCP clients
  methods: ['GET', 'POST'], // Only allow GET and POST methods
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({
  limit: '1mb', // Set request size limit
  strict: false, // Be more lenient in JSON parsing
}));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Request received`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Response ${res.statusCode} (${duration}ms)`);
  });
  
  // Log if client closes connection
  req.on('close', () => {
    if (!res.finished) {
      console.warn(`[${new Date().toISOString()}] ${req.method} ${req.url} - Client closed connection prematurely`);
    }
  });
  
  next();
});

// Weatherstack API details
const DEFAULT_API_KEY = 'a07119cef2e19d493340c892615a1397';
const WEATHERSTACK_API_KEY = process.env.WEATHERSTACK_API_KEY || DEFAULT_API_KEY;
const WEATHERSTACK_API_URL = 'http://api.weatherstack.com/current';

// Check if using default API key and warn users
if (WEATHERSTACK_API_KEY === DEFAULT_API_KEY && require.main === module) {
  console.warn('\n⚠️  Warning: Using the default Weatherstack API key');
  console.warn('This key has limited usage and is for demonstration purposes only.');
  console.warn('For production use, please set your own API key:');
  console.warn('export WEATHERSTACK_API_KEY="your_api_key_here"\n');
}

/**
 * Validates the API key
 * @returns {boolean} - Whether the API key is valid
 */
function isValidApiKey() {
  return WEATHERSTACK_API_KEY && WEATHERSTACK_API_KEY.length > 0;
}

/**
 * Fetches weather data for a city from the Weatherstack API
 * @param {string} city - Name of the city
 * @returns {Promise<object>} - Weather data
 */
async function fetchWeatherData(city) {
  if (!city) {
    throw new Error('City parameter is required');
  }
  
  if (!isValidApiKey()) {
    throw new Error('No Weatherstack API key provided. Please set WEATHERSTACK_API_KEY environment variable.');
  }
  
  const normalizedCity = city.trim();
  console.log(`Fetching weather data for city: ${normalizedCity}`);
  
  const apiUrl = `${WEATHERSTACK_API_URL}?access_key=${WEATHERSTACK_API_KEY}&query=${encodeURIComponent(normalizedCity)}`;
  
  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Weatherstack API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      // Check for API key related errors specifically
      if (data.error.code === 101 || data.error.code === 102 || data.error.code === 103) {
        throw new Error(`Weatherstack API key error: ${data.error.info}`);
      }
      throw new Error(`Weatherstack API error: ${data.error.info}`);
    }
    
    console.log(`Successfully fetched weather data for ${normalizedCity}`);
    return data;
  } catch (error) {
    console.error(`Error fetching weather data: ${error.message}`);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    apiKeyConfigured: isValidApiKey()
  });
});

// MCP API endpoint - handles both GET and POST requests
app.all('/mcp', async (req, res) => {
  try {
    // Handle GET request for capabilities discovery
    if (req.method === 'GET') {
      console.log('Received capabilities discovery request');
      return res.json({
        jsonrpc: "2.0",
        result: {
          protocol: {
            name: 'mcp',
            version: '0.1.0'
          },
          tools: {
            weather: {
              description: 'Get weather information for a location',
              operations: {
                currentWeather: {
                  description: 'Get current weather for a city or location',
                  parameters: {
                    city: {
                      type: 'string',
                      description: 'City name (e.g., "New York")'
                    }
                  }
                }
              }
            }
          }
        }
      });
    }
    
    // Handle POST request for tool usage (JSON-RPC format)
    if (req.method === 'POST') {
      console.log('Received tool usage request:', JSON.stringify(req.body));
      
      // Ensure proper JSON-RPC format
      const { jsonrpc, id, method, params } = req.body;
      
      // Validate JSON-RPC request
      if (!jsonrpc || jsonrpc !== '2.0') {
        console.warn(`Invalid JSON-RPC version: ${jsonrpc}`);
        return res.json({
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Request must follow JSON-RPC 2.0 specification'
          }
        });
      }
      
      if (!method) {
        console.warn('Missing method in request');
        return res.json({
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Method is required'
          }
        });
      }
      
      // Parse the method - accept both formats: "tool.operation" or direct method name
      let tool, operation;
      
      if (method.includes('.')) {
        [tool, operation] = method.split('.');
      } else {
        // For clients that might send just the operation name
        // We'll default to the weather tool
        tool = 'weather';
        operation = method;
      }
      
      console.log(`Processing request for tool: ${tool}, operation: ${operation}`);
      
      // Handle unsupported tools
      if (tool !== 'weather') {
        console.warn(`Unsupported tool requested: ${tool}`);
        return res.json({
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unsupported tool: ${tool}. Currently only 'weather' tool is supported.`
          }
        });
      }
      
      // Handle operation
      if (operation === 'currentWeather') {
        try {
          // Extract parameters - handle different parameter formats
          let city;
          if (typeof params === 'object' && params !== null) {
            city = params.city;
          } else if (typeof params === 'string') {
            city = params;
          }
          
          if (!city) {
            console.warn('Missing city parameter');
            return res.json({
              jsonrpc: '2.0',
              id: id || null,
              error: {
                code: -32602,
                message: 'Invalid params',
                data: 'City parameter is required'
              }
            });
          }
          
          // Fetch weather data
          const data = await fetchWeatherData(city);
          
          // Return standardized weather data in JSON-RPC format
          const response = {
            jsonrpc: '2.0',
            id: id || null,
            result: {
              city: data.location.name,
              country: data.location.country,
              region: data.location.region,
              localtime: data.location.localtime,
              current: {
                temperature: data.current.temperature,
                temperatureUnit: 'C',
                weather: data.current.weather_descriptions.join(', '),
                weatherIcon: data.current.weather_icons[0],
                windSpeed: data.current.wind_speed,
                windDirection: data.current.wind_dir,
                humidity: data.current.humidity,
                feelsLike: data.current.feelslike,
                uvIndex: data.current.uv_index,
                visibility: data.current.visibility,
                precipitation: data.current.precip,
                cloudCover: data.current.cloudcover,
                pressure: data.current.pressure
              }
            }
          };
          
          console.log(`Successfully processed weather request for: ${city}`);
          return res.json(response);
        } catch (error) {
          console.error(`Error processing weather request: ${error.message}`);
          // Return error in JSON-RPC format
          return res.json({
            jsonrpc: '2.0',
            id: id || null,
            result: {
              status: "not available",
              message: "Weather data is currently not available"
            }
          });
        }
      } else {
        // Handle unsupported operations
        console.warn(`Unsupported operation requested: ${operation}`);
        return res.json({
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unsupported operation: ${operation}`
          }
        });
      }
    }
    
    // Handle any other HTTP methods
    console.warn(`Unsupported HTTP method: ${req.method}`);
    return res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
        data: `HTTP method ${req.method} not supported`
      }
    });
  } catch (error) {
    // Catch any unexpected errors to prevent server crashes
    console.error(`Unexpected error processing request: ${error.message}`);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: 'An unexpected error occurred'
      }
    });
  }
});

// Store server instance for graceful shutdown
let server;

// Setup graceful shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
  console.log('Received shutdown signal, closing server...');
  if (server) {
    server.close(() => {
      console.log('Server closed gracefully');
      process.exit(0);
    });
    
    // Force close if it takes too long
    setTimeout(() => {
      console.error('Server could not close gracefully, forcing shutdown');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// CLI mode for direct weather lookup
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === 'weather') {
    const cityArg = args.slice(1).join(' ');
    
    if (!cityArg) {
      console.log("Please provide a city name. Example: node src/index.js weather 'New York'");
      process.exit(1);
    }
    
    console.log(`Fetching weather data for ${cityArg}...`);
    
    fetchWeatherData(cityArg)
      .then(data => {
        console.log(`\nCurrent Weather for ${data.location.name}, ${data.location.country}`);
        console.log("=".repeat(50));
        console.log(`Date & Time: ${data.location.localtime}`);
        console.log(`Temperature: ${data.current.temperature}°C (Feels like: ${data.current.feelslike}°C)`);
        console.log(`Weather: ${data.current.weather_descriptions.join(', ')}`);
        console.log(`Wind: ${data.current.wind_speed} km/h ${data.current.wind_dir}`);
        console.log(`Humidity: ${data.current.humidity}%`);
        console.log(`Visibility: ${data.current.visibility} km`);
        console.log(`Pressure: ${data.current.pressure} mb`);
        console.log(`UV Index: ${data.current.uv_index}`);
        console.log("\nData source: Weatherstack API");
      })
      .catch(error => {
        if (error.message.includes('API key')) {
          console.error(`\n❌ API Key Error: ${error.message}`);
          console.log("Please set your Weatherstack API key using:");
          console.log("export WEATHERSTACK_API_KEY=\"your_api_key_here\"");
        } else {
          console.log("\nWeather data is not available");
        }
      });
  } else {
    // Start the server
    server = app.listen(port, () => {
      console.log(`Weather MCP server running at http://localhost:${port}`);
      console.log(`Server capabilities available at: http://localhost:${port}/mcp`);
      console.log(`\nQuick usage: node src/index.js weather "city name"`);
    });
  }
}

// Export functions for npm package usage
module.exports = {
  fetchWeatherData,
  isValidApiKey,
  startServer: (customPort) => {
    const serverPort = customPort || port;
    server = app.listen(serverPort, () => {
      console.log(`Weather MCP server running at http://localhost:${serverPort}`);
    });
    return server;
  },
  getWeatherForCity: async (city) => {
    try {
      return await fetchWeatherData(city);
    } catch (error) {
      return { status: "not available", message: "Weather data is currently not available" };
    }
  }
};