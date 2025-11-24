#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fal } from "@fal-ai/client";
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Check for required environment variable
const FAL_KEY = process.env.FAL_KEY;
let falClient: any = null;

if (!FAL_KEY) {
  console.error('FAL_KEY environment variable is required');
  console.error('Please set your FAL API key: export FAL_KEY=your_token_here');
  // Server continues running, no process.exit()
} else {
  // Configure FAL client
  fal.config({
    credentials: FAL_KEY
  });
  falClient = fal;
}

// Define types based on Reve API documentation
interface ReveImageResult {
  images: Array<{
    url: string;
    content_type?: string;
    width?: number;
    height?: number;
  }>;
}

// Download image function
async function downloadImage(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      // Create images directory if it doesn't exist
      const imagesDir = path.join(process.cwd(), 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      const filePath = path.join(imagesDir, filename);
      const file = fs.createWriteStream(filePath);
      
      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Generate safe filename for images
function generateImageFilename(prompt: string, index: number, outputFormat: string): string {
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `reve_${safePrompt}_${index}_${timestamp}.${outputFormat}`;
}

// Create MCP server
const server = new McpServer({
  name: "fal-reve-server",
  version: "1.0.0",
});

// Tool: Generate images with Reve
server.tool(
  "reve_generate",
  {
    description: "Generate high-quality images using Reve - text-to-image model that generates detailed visual output closely following your instructions, with strong aesthetic quality and accurate text rendering",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The text description of the desired image"
        },
        sync_mode: {
          type: "boolean",
          description: "If true, the media will be returned as a data URI and the output data won't be available in the request history",
          default: false
        },
        num_images: {
          type: "integer",
          minimum: 1,
          maximum: 4,
          description: "Number of images to generate (1-4)",
          default: 1
        },
        output_format: {
          type: "string",
          enum: ["png", "jpeg", "webp"],
          description: "Output format for the generated image",
          default: "png"
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "1:1"],
          description: "The desired aspect ratio of the generated image",
          default: "3:2"
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    // Check if FAL client is configured
    if (!falClient) {
      return {
        content: [{
          type: "text",
          text: "Error: FAL_KEY environment variable is not set. Please configure your FAL API key."
        }],
        isError: true
      };
    }

    const { 
      prompt, 
      sync_mode = false, 
      num_images = 1, 
      output_format = "png", 
      aspect_ratio = "3:2" 
    } = args;
    
    try {
      // Prepare input for FAL API
      const input: any = {
        prompt,
        sync_mode,
        num_images,
        output_format,
        aspect_ratio
      };

      console.error(`Generating ${num_images} image(s) with Reve - prompt: "${prompt}"`);

      // Call FAL Reve API
      const result = await fal.subscribe("fal-ai/reve/text-to-image", {
        input,
        logs: true,
        onQueueUpdate: (update: any) => {
          if (update.status === "IN_PROGRESS") {
            update.logs?.map((log: any) => log.message).forEach((msg: string) => 
              console.error(`FAL Log: ${msg}`)
            );
          }
        },
      }) as { data: ReveImageResult; requestId: string };

      // Download images locally
      console.error("Downloading images locally...");
      const downloadedImages = [];

      for (let i = 0; i < result.data.images.length; i++) {
        const img = result.data.images[i];
        const filename = generateImageFilename(prompt, i + 1, output_format);
        
        try {
          const localPath = await downloadImage(img.url, filename);
          downloadedImages.push({
            url: img.url,
            localPath,
            index: i + 1,
            content_type: img.content_type || `image/${output_format}`,
            width: img.width,
            height: img.height
          });
          console.error(`Downloaded: ${filename}`);
        } catch (downloadError) {
          console.error(`Failed to download image ${i + 1}:`, downloadError);
          // Still add the image info without local path
          downloadedImages.push({
            url: img.url,
            localPath: null,
            index: i + 1,
            content_type: img.content_type || `image/${output_format}`,
            width: img.width,
            height: img.height
          });
        }
      }

      // Format response with download information
      const imageDetails = downloadedImages.map(img => {
        let details = `Image ${img.index}:`;
        if (img.localPath) {
          details += `\n  Local Path: ${img.localPath}`;
        }
        details += `\n  Original URL: ${img.url}`;
        if (img.width && img.height) {
          details += `\n  Dimensions: ${img.width}x${img.height}`;
        }
        return details;
      }).join('\n\n');

      const responseText = `Successfully generated ${downloadedImages.length} image(s) using Reve:

Prompt: "${prompt}"
Aspect Ratio: ${aspect_ratio}
Output Format: ${output_format}
Request ID: ${result.requestId}

Generated Images:
${imageDetails}

${downloadedImages.some(img => img.localPath) ? 'Images have been downloaded to the local \'images\' directory.' : 'Note: Local download failed, but original URLs are available.'}`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error generating image:', error);
      
      let errorMessage = "Failed to generate image with Reve.";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Generate images using queue method (for longer requests)
server.tool(
  "reve_generate_async",
  {
    description: "Generate images using Reve with async queue method for longer requests",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The text description of the desired image"
        },
        sync_mode: {
          type: "boolean",
          description: "If true, the media will be returned as a data URI and the output data won't be available in the request history",
          default: false
        },
        num_images: {
          type: "integer",
          minimum: 1,
          maximum: 4,
          description: "Number of images to generate (1-4)",
          default: 1
        },
        output_format: {
          type: "string",
          enum: ["png", "jpeg", "webp"],
          description: "Output format for the generated image",
          default: "png"
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "1:1"],
          description: "The desired aspect ratio of the generated image",
          default: "3:2"
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    // Check if FAL client is configured
    if (!falClient) {
      return {
        content: [{
          type: "text",
          text: "Error: FAL_KEY environment variable is not set. Please configure your FAL API key."
        }],
        isError: true
      };
    }

    const { 
      prompt, 
      sync_mode = false, 
      num_images = 1, 
      output_format = "png", 
      aspect_ratio = "3:2" 
    } = args;
    
    try {
      // Prepare input for FAL API
      const input: any = {
        prompt,
        sync_mode,
        num_images,
        output_format,
        aspect_ratio
      };

      console.error(`Submitting async request for ${num_images} image(s) with Reve - prompt: "${prompt}"`);

      // Submit request to queue
      const { request_id } = await fal.queue.submit("fal-ai/reve/text-to-image", {
        input
      });

      console.error(`Request submitted with ID: ${request_id}`);

      // Poll for completion
      let result;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals

      while (attempts < maxAttempts) {
        const status = await fal.queue.status("fal-ai/reve/text-to-image", {
          requestId: request_id,
          logs: true
        });

        console.error(`Status check ${attempts + 1}: ${status.status}`);

        if (status.status === "COMPLETED") {
          result = await fal.queue.result("fal-ai/reve/text-to-image", {
            requestId: request_id
          });
          break;
        }
        
        // Check if we should continue polling
        if (status.status !== "IN_QUEUE" && status.status !== "IN_PROGRESS") {
          throw new Error(`Image generation failed with status: ${(status as any).status}`);
        }

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }

      if (!result) {
        throw new Error("Request timed out after 5 minutes");
      }

      // Download images locally
      console.error("Downloading images locally...");
      const downloadedImages = [];

      for (let i = 0; i < result.data.images.length; i++) {
        const img = result.data.images[i];
        const filename = generateImageFilename(prompt, i + 1, output_format);
        
        try {
          const localPath = await downloadImage(img.url, filename);
          downloadedImages.push({
            url: img.url,
            localPath,
            index: i + 1,
            content_type: img.content_type || `image/${output_format}`,
            width: img.width,
            height: img.height
          });
          console.error(`Downloaded: ${filename}`);
        } catch (downloadError) {
          console.error(`Failed to download image ${i + 1}:`, downloadError);
          // Still add the image info without local path
          downloadedImages.push({
            url: img.url,
            localPath: null,
            index: i + 1,
            content_type: img.content_type || `image/${output_format}`,
            width: img.width,
            height: img.height
          });
        }
      }

      // Format response with download information
      const imageDetails = downloadedImages.map(img => {
        let details = `Image ${img.index}:`;
        if (img.localPath) {
          details += `\n  Local Path: ${img.localPath}`;
        }
        details += `\n  Original URL: ${img.url}`;
        if (img.width && img.height) {
          details += `\n  Dimensions: ${img.width}x${img.height}`;
        }
        return details;
      }).join('\n\n');

      const responseText = `Successfully generated ${downloadedImages.length} image(s) using Reve (Async):

Prompt: "${prompt}"
Aspect Ratio: ${aspect_ratio}
Output Format: ${output_format}
Request ID: ${request_id}

Generated Images:
${imageDetails}

${downloadedImages.some(img => img.localPath) ? 'Images have been downloaded to the local \'images\' directory.' : 'Note: Local download failed, but original URLs are available.'}`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error in async image generation:', error);
      
      let errorMessage = "Failed to generate image with Reve (async).";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);


// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FAL Reve MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  // Don't exit the process, let it continue running
});