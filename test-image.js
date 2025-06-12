const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');
const FormData = require('form-data');

dotenv.config();

const replicateApiKey = process.env.REPLICATE_API_KEY;
const imagePath = '/Users/ochszy/Downloads/resized_IMG_0079.png';

async function uploadImageToReplicate(imagePath) {
  try {
    console.log('Uploading image to Replicate...');
    
    const form = new FormData();
    form.append('content', fs.createReadStream(imagePath));
    
    const response = await axios.post('https://api.replicate.com/v1/files', form, {
      headers: {
        'Authorization': `Token ${replicateApiKey}`,
        ...form.getHeaders(),
      },
    });
    
    console.log('Image uploaded successfully:', response.data.urls.get);
    return response.data.urls.get;
  } catch (error) {
    console.error('Image upload failed:', error.message);
    if (error.response) {
      console.error('Upload error details:', error.response.data);
    }
    throw error;
  }
}

async function testCorrectFluxKontext() {
  try {
    // Step 1: Upload image to Replicate (like the web interface does)
    const imageUrl = await uploadImageToReplicate(imagePath);
    
    // Step 2: Use the exact parameters from the web interface
    const payload = {
      version: "black-forest-labs/flux-kontext-pro",
      input: {
        prompt: "Do a GTAV Loading screen art style version of this image. Keep all original Features.\n",
        input_image: imageUrl,  // Use uploaded URL, not base64
        aspect_ratio: "match_input_image",
        output_format: "jpg",
        safety_tolerance: 2
      }
    };

    console.log('\nSending request with CORRECT web interface parameters...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const startTime = Date.now();
    const response = await axios.post('https://api.replicate.com/v1/predictions', payload, {
      headers: {
        'Authorization': `Token ${replicateApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Prediction created:', response.data.id);
    console.log('Check result:', `https://replicate.com/p/${response.data.id}`);
    const predictionId = response.data.id;
    
    // Step 3: Poll for results
    let result;
    let attempts = 0;
    const maxAttempts = 180;
    
    while (!result && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusResponse = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
        },
      });
      
      console.log(`Attempt ${attempts}: Status = ${statusResponse.data.status}`);
      
      if (statusResponse.data.status === 'succeeded') {
        result = statusResponse.data.output;
      } else if (statusResponse.data.status === 'failed') {
        console.error('Full error response:', JSON.stringify(statusResponse.data, null, 2));
        throw new Error(`Prediction failed: ${JSON.stringify(statusResponse.data.error)}`);
      }
    }

    if (!result) {
      throw new Error('Prediction timed out after 3 minutes');
    }

    const endTime = Date.now();
    console.log('Generation duration:', (endTime - startTime) / 1000, 'seconds');
    console.log('🎉 SUCCESS! Generated image URL:', result);
    
    return result;
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Test with variations of the web interface prompt
async function testPromptVariations() {
  console.log('\n=== TESTING PROMPT VARIATIONS ===');
  
  const imageUrl = await uploadImageToReplicate(imagePath);
  
  const prompts = [
    "Do a GTAV Loading screen art style version of this image. Keep all original Features.\n",
    "Transform this image into GTA V loading screen art style. Preserve all original features.",
    "Convert to GTA loading screen style while keeping all details.",
  ];
  
  for (let i = 0; i < prompts.length; i++) {
    try {
      console.log(`\nTesting prompt ${i + 1}: "${prompts[i]}"`);
      
      const payload = {
        version: "black-forest-labs/flux-kontext-pro",
        input: {
          prompt: prompts[i],
          input_image: imageUrl,
          aspect_ratio: "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2
        }
      };

      const response = await axios.post('https://api.replicate.com/v1/predictions', payload, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Prediction ID: ${response.data.id}`);
      console.log(`   Check: https://replicate.com/p/${response.data.id}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

async function runCorrectTests() {
  console.log('=== TESTING WITH CORRECT WEB INTERFACE PARAMETERS ===\n');
  console.log('Key changes based on network inspection:');
  console.log('1. Using input_image parameter (not reference_image)');
  console.log('2. Uploading image to Replicate first (not base64)');
  console.log('3. Using aspect_ratio: "match_input_image"');
  console.log('4. Using output_format: "jpg"');
  console.log('5. Using safety_tolerance: 2');
  console.log('6. Using the exact web interface prompt\n');
  
  try {
    await testCorrectFluxKontext();
    await testPromptVariations();
    
    console.log('\n🎯 This should now work exactly like the web interface!');
    console.log('Next step: Update your server.js and api/generate-image.js with these parameters.');
    
  } catch (error) {
    console.error('Tests failed:', error.message);
  }
}

runCorrectTests();