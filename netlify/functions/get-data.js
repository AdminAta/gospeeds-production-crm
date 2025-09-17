// netlify/functions/get-data.js
// This function allows the frontend to fetch webhook data
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const agentEmail = event.queryStringParameters?.agent;
    
    if (!agentEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Agent email required' })
      };
    }

    // For now, return empty since we're using localStorage
    // In future, this would connect to a database
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        agent: agentEmail,
        leads: [],
        message: 'Using browser storage for data persistence'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
