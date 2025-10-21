async function testTranscriptionAPI() {
  const apiUrl = 'http://localhost:3000/api/transcription';

  try {
    console.log('Testing transcription API...');

    // Test with invalid input to see if the API responds
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Invalid input - should get a validation error
        invalidField: 'test'
      }),
    });

    const result = await response.json();
    console.log('API Response Status:', response.status);
    console.log('API Response:', result);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTranscriptionAPI();