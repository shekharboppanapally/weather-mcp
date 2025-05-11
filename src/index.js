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
app.use(cors());
app.use(express.json());

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
  const apiUrl = `${WEATHERSTACK_API_URL}?access_key=${WEATHERSTACK_API_KEY}&query=${encodeURIComponent(normalizedCity)}`;
  
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
  
  return data;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    apiKeyConfigured: isValidApiKey()
  });
});

// MCP API endpoint for obtaining capabilities
app.get('/mcp', (req, res) => {
  res.json({
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
  });
});

// MCP API endpoint for using tools
app.post('/mcp', async (req, res) => {
  try {
    const { tool, operation, parameters } = req.body;
    
    if (tool !== 'weather') {
      return res.status(400).json({ 
        error: `Unsupported tool: ${tool}. Currently only 'weather' tool is supported.` 
      });
    }
    
    if (operation === 'currentWeather') {
      try {
        const data = await fetchWeatherData(parameters.city);
        
        // Return standardized weather data
        res.json({
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
        });
      } catch (error) {
        // Simply return "not available" when API is unavailable
        res.json({
          result: {
            status: "not available",
            message: "Weather data is currently not available"
          }
        });
      }
    }
    else {
      res.status(400).json({ error: `Unsupported operation: ${operation}` });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      message: "Weather data is not available"
    });
  }
});

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
    app.listen(port, () => {
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
    return app.listen(serverPort, () => {
      console.log(`Weather MCP server running at http://localhost:${serverPort}`);
    });
  },
  getWeatherForCity: async (city) => {
    try {
      return await fetchWeatherData(city);
    } catch (error) {
      return { status: "not available", message: "Weather data is currently not available" };
    }
  }
};