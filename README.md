# FAL Reve MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io/)
[![FAL AI](https://img.shields.io/badge/FAL%20AI-Reve-green)](https://fal.ai/)

A Model Context Protocol (MCP) server that provides access to Reve - a text-to-image model that generates detailed visual output closely following your instructions, with strong aesthetic quality and accurate text rendering.

**🔗 Repository**: [https://github.com/PierrunoYT/fal-reve-mcp-server](https://github.com/PierrunoYT/fal-reve-mcp-server)

> **✅ Enhanced Reliability**: Server handles missing API keys gracefully without crashes and includes robust error handling.

## Features

- **High-Quality Image Generation**: Uses Reve - a text-to-image model via FAL AI
- **Detailed Visual Output**: Generates images that closely follow your instructions
- **Strong Aesthetic Quality**: Produces visually appealing results
- **Accurate Text Rendering**: Superior text integration and rendering capabilities
- **Automatic Image Download**: Generated images are automatically saved to local `images` directory
- **Multiple Aspect Ratios**: Support for 16:9, 9:16, 3:2, 2:3, 4:3, 3:4, and 1:1
- **Batch Generation**: Generate up to 4 images at once
- **Dual Generation Methods**: Both real-time and async queue-based generation
- **Flexible Output Formats**: Support for PNG, JPEG, and WebP formats
- **Detailed Responses**: Returns both local file paths and original URLs with metadata
- **Robust Error Handling**: Graceful handling of missing API keys without server crashes
- **Universal Portability**: Works anywhere with npx - no local installation required
- **Enhanced Reliability**: Graceful shutdown handlers and comprehensive error reporting

## Prerequisites

- Node.js 18 or higher
- FAL AI API key

## Installation

### 1. Get your FAL AI API Key

- Visit [FAL AI](https://fal.ai/)
- Sign up for an account
- Navigate to your dashboard
- Generate an API key

### 2. Clone or Download

```bash
git clone https://github.com/PierrunoYT/fal-reve-mcp-server.git
cd fal-reve-mcp-server
```

### 3. Install Dependencies and Build

```bash
npm install
npm run build
```

This will compile the TypeScript source code to JavaScript in the `build/` directory.

## Configuration

### 🚀 Recommended: Universal npx Configuration (Works Everywhere)

**Best option for portability** - works on any machine with Node.js:

```json
{
  "mcpServers": {
    "fal-reve": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/PierrunoYT/fal-reve-mcp-server.git"
      ],
      "env": {
        "FAL_KEY": "your-fal-api-key-here"
      }
    }
  }
}
```

**Benefits:**
- ✅ **Universal Access**: Works on any machine with Node.js
- ✅ **No Local Installation**: npx downloads, builds, and runs automatically
- ✅ **Always Latest Version**: Pulls from GitHub repository
- ✅ **Cross-Platform**: Windows, macOS, Linux compatible
- ✅ **Settings Sync**: Works everywhere you use your MCP client
- ✅ **Auto-Build**: Automatically compiles TypeScript on first run

### Alternative: Local Installation

If you prefer to install locally, use the path helper:

```bash
npm run get-path
```

This will output the complete MCP configuration with the correct absolute path.

#### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "fal-reve": {
      "command": "node",
      "args": ["path/to/fal-reve-mcp-server/build/index.js"],
      "env": {
        "FAL_KEY": "your-fal-api-key-here"
      }
    }
  }
}
```

#### For Kilo Code MCP Settings

Add to your MCP settings file at:
`C:\Users\[username]\AppData\Roaming\Kilo-Code\MCP\settings\mcp_settings.json`

```json
{
  "mcpServers": {
    "fal-reve": {
      "command": "node",
      "args": ["path/to/fal-reve-mcp-server/build/index.js"],
      "env": {
        "FAL_KEY": "your-fal-api-key-here"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

## Available Tools

### `reve_generate`

Generate images using Reve with real-time processing.

**Parameters:**
- `prompt` (required): The text description of the desired image
- `sync_mode` (optional): If true, the media will be returned as a data URI and the output data won't be available in the request history (default: false)
- `num_images` (optional): Number of images to generate, 1-4 (default: 1)
- `output_format` (optional): "png", "jpeg", or "webp" (default: "png")
- `aspect_ratio` (optional): "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", or "1:1" (default: "3:2")

**Response includes:**
- Image URLs for immediate access
- Generation metadata (request ID)
- File information (content type, dimensions)
- Local file paths for downloaded images

### `reve_generate_async`

Generate images using Reve with async queue processing for longer requests.

**Parameters:** Same as `reve_generate`

**Use this tool when:**
- Generating multiple images (2-4)
- Complex prompts that might take longer
- When the regular tool times out
- For batch processing workflows

**Features:**
- Queue-based processing with status polling
- 5-minute timeout with progress updates
- Detailed logging of generation progress

## 📥 **How Image Download Works**

The FAL Reve MCP server automatically downloads generated images to your local machine. Here's the complete process:

### **1. Image Generation Flow**
1. **API Call**: Server calls FAL AI's Reve API
2. **Response**: FAL returns temporary URLs for generated images
3. **Auto-Download**: Server immediately downloads images to local storage
4. **Response**: Returns both local paths and original URLs

### **2. Download Implementation**

#### **Download Function** ([`downloadImage`](src/index.ts:37-71)):
```typescript
async function downloadImage(url: string, filename: string): Promise<string> {
  // 1. Parse the URL and determine HTTP/HTTPS client
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;
  
  // 2. Create 'images' directory if it doesn't exist
  const imagesDir = path.join(process.cwd(), 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // 3. Create file write stream
  const filePath = path.join(imagesDir, filename);
  const file = fs.createWriteStream(filePath);
  
  // 4. Download and pipe to file
  client.get(url, (response) => {
    response.pipe(file);
    // Handle completion and errors
  });
}
```

#### **Filename Generation** ([`generateImageFilename`](src/index.ts:74-82)):
```typescript
function generateImageFilename(prompt: string, index: number, outputFormat: string): string {
  // Creates safe filename: reve_prompt_index_timestamp.png
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .substring(0, 50);            // Limit length
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `reve_${safePrompt}_${index}_${timestamp}.${outputFormat}`;
}
```

### **3. File Storage Details**

#### **Directory Structure:**
```
your-project/
├── images/                    # Auto-created directory
│   ├── reve_mountain_landscape_1_2025-06-24T18-30-45-123Z.png
│   ├── reve_cute_robot_1_2025-06-24T18-31-20-456Z.png
│   └── ...
```

#### **Filename Format:**
- **Prefix**: `reve_`
- **Prompt**: First 50 chars, sanitized (alphanumeric + underscores)
- **Index**: Image number (for multiple images)
- **Timestamp**: ISO timestamp for uniqueness
- **Extension**: `.png`, `.jpeg`, or `.webp` based on output_format

### **4. Response Format**

The server returns both local and remote information:
```
Successfully generated 1 image(s) using Reve:

Prompt: "a serene mountain landscape with text 'REVE' painted in white"
Aspect Ratio: 3:2
Output Format: png
Request ID: req_abc123

Generated Images:
Image 1:
  Local Path: /path/to/project/images/reve_a_serene_mountain_landscape_1_2025-06-24T18-30-45-123Z.png
  Original URL: https://v3.fal.media/files/...
  Dimensions: 1024x1024

Images have been downloaded to the local 'images' directory.
```

## Example Usage

### Basic Image Generation
```
Generate a photorealistic image of a golden retriever playing in a field of sunflowers with the text "HAPPY DOG" written in bold letters
```

### With Specific Parameters
```
Generate an image with:
- Prompt: "A minimalist logo design for a tech startup, clean lines, with 'STARTUP' text"
- Aspect ratio: 16:9
- Output format: png
- Number of images: 2
```

### Advanced Usage with Text Rendering
```
Generate 4 images of "A futuristic cityscape at night with neon lights and flying cars, large billboard displaying 'FUTURE CITY 2025'" 
with aspect ratio 16:9
```

### Text-Heavy Prompts (Reve Specialty)
```
Create an image of a vintage bookstore with multiple book spines showing titles like "The Art of Code", "Digital Dreams", and "Future Stories" clearly readable
```

### WebP Format Example
```
Generate an image with:
- Prompt: "A serene mountain landscape at sunset"
- Output format: webp
- Aspect ratio: 3:2
```

## Technical Details

### Architecture
- **Language**: TypeScript with ES2022 target
- **Runtime**: Node.js 18+ with ES modules
- **Protocol**: Model Context Protocol (MCP) SDK v1.0.0
- **API Client**: FAL AI JavaScript client v1.0.0
- **Validation**: Zod schema validation

### API Endpoints Used
- **Text-to-Image Real-time**: `fal-ai/reve/text-to-image` (subscribe method)
- **Text-to-Image Async**: `fal-ai/reve/text-to-image` (queue method)

### Error Handling
- **Graceful API key handling**: Server continues running even without FAL_KEY set
- **No crash failures**: Removed `process.exit()` calls that caused connection drops
- **Null safety checks**: All tools validate API client availability before execution
- **Graceful shutdown**: Proper SIGINT and SIGTERM signal handling
- **API error catching**: Comprehensive error reporting with detailed context
- **Timeout handling**: Robust async request management with progress updates
- **User-friendly messages**: Clear error descriptions instead of technical crashes

## Development

### Project Structure
```
├── src/
│   └── index.ts          # Main MCP server implementation
├── build/                # Compiled JavaScript (created after running npm run build)
├── test-server.js        # Server testing utility
├── get-path.js          # Configuration path helper
├── example-mcp-config.json # Example configuration
├── package.json         # Project metadata and dependencies
└── tsconfig.json        # TypeScript configuration
```

### Scripts
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm run start` - Start the server directly
- `npm run test` - Test server startup and basic functionality
- `npm run get-path` - Get configuration path for your system

### Making Changes
1. Edit files in the `src/` directory
2. Run `npm run build` to compile
3. Restart your MCP client to use the updated server

### Testing
```bash
npm run test
```

This runs a basic connectivity test that verifies:
- Server starts correctly
- MCP protocol initialization
- Tool discovery functionality

## API Costs

This server uses the FAL AI platform, which charges per image generation. Check [FAL AI pricing](https://fal.ai/pricing) for current rates.

**Typical costs** (as of 2024):
- Reve: Check [FAL AI pricing](https://fal.ai/pricing) for current rates
- Costs vary by resolution and complexity

## Troubleshooting

### Server not appearing in MCP client
1. **Recommended**: Use the npx configuration for universal compatibility
2. If using local installation, verify the path to `build/index.js` is correct and absolute
3. Ensure Node.js 18+ is installed: `node --version`
4. Test server startup: `npm run test`
5. Restart your MCP client (Claude Desktop, Kilo Code, etc.)
6. **Note**: Server will start successfully even without FAL_KEY - check tool responses for API key errors

### Image generation failing
1. Verify your FAL API key is valid and has sufficient credits
2. Check that your prompt follows FAL AI's content policy
3. Try reducing the number of images or simplifying the prompt
4. Use the async tool for complex requests
5. Check the server logs for detailed error messages
6. Ensure the Reve model is available in your region

### Build issues
If you encounter build errors or need to rebuild the server:
```bash
npm install
npm run build
```

**Note**: The `build/` directory must exist before using the server. Make sure to run `npm run build` after cloning the repository.

### Configuration issues
Use the helper script to get the correct path:
```bash
npm run get-path
```

## Support

For issues with:
- **This MCP server**: Create an issue in this repository
- **FAL AI API**: Check [FAL AI documentation](https://fal.ai/docs)
- **MCP Protocol**: See [MCP documentation](https://modelcontextprotocol.io/)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run test`
5. Submit a pull request

## Changelog

### v1.0.0
- **🚀 Initial release**: Reve support via FAL AI
- **📥 Automatic image download**: Generated images are automatically saved to local `images` directory
- **🗂️ Smart filename generation**: Images saved with descriptive names including prompt and timestamp
- **🔄 Enhanced responses**: Returns both local file paths and original URLs for maximum flexibility
- **📁 Auto-directory creation**: Creates `images` folder automatically if it doesn't exist
- **🛡️ Download error handling**: Graceful fallback to original URLs if local download fails
- **🎨 Accurate text rendering**: Superior text integration capabilities with Reve
- **⚙️ Comprehensive controls**: Full parameter support including aspect ratios and output formats
- **🔄 Dual generation methods**: Both real-time and async queue-based generation
- **📐 Multiple aspect ratios**: Support for 7 different aspect ratios (16:9, 9:16, 3:2, 2:3, 4:3, 3:4, 1:1)
- **🖼️ Multiple output formats**: Support for PNG, JPEG, and WebP formats
- **🔧 Robust error handling**: Graceful shutdown handlers and comprehensive error reporting
- **🌍 Universal portability**: Works everywhere with npx configuration