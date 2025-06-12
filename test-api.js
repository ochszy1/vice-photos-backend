const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testApi() {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello, this is a test.' }],
    });
    console.log('API Test Success:', response.choices[0].message.content);
  } catch (error) {
    console.error('API Test Error:', error.message);
    if (error.response) console.error('Status:', error.response.status);
  }
}

testApi();