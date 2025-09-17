// netlify/functions/webhook.js
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse the incoming webhook data from Kixie
    const webhookData = JSON.parse(event.body);
    
    console.log('GoSpeeds Production Webhook received:', JSON.stringify(webhookData, null, 2));

    // Extract data from Kixie's nested structure
    const data = webhookData.data;
    if (!data) {
      console.log('No data object found in webhook');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid webhook format - missing data object' })
      };
    }

    const callDetails = data.callDetails;
    const powerlistContactDetails = data.powerlistContactDetails?.result;
    
    // Get agent email from call details
    const agentEmail = callDetails?.email;
    
    if (!agentEmail) {
      console.log('No agent email found in webhook data');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing agent email in callDetails' })
      };
    }

    // GoSpeeds agent validation
    const validAgents = [
      'umar@gospeeds.com',
      'ata@gospeeds.com', 
      'matthew@gospeeds.com',
      'bilal@gospeeds.com',
      'raheem@gospeeds.com',
      'shamail@gospeeds.com'
    ];

    if (!validAgents.includes(agentEmail)) {
      console.log(`Invalid agent email: ${agentEmail}`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid agent email',
          received: agentEmail,
          valid: validAgents 
        })
      };
    }

    // Parse address and industry from ssData JSON
    let address = '';
    let industry = '';
    try {
      if (powerlistContactDetails?.ssData) {
        const ssData = JSON.parse(powerlistContactDetails.ssData);
        if (ssData['Street Address'] || ssData.City || ssData.State) {
          address = [
            ssData['Street Address'],
            ssData.City,
            ssData.State,
            ssData.Zipcode
          ].filter(Boolean).join(', ');
        }
        industry = ssData.Industry || '';
      }
    } catch (e) {
      console.log('Could not parse ssData:', e);
    }

    // Process the webhook data with Kixie's actual structure
    const processedLead = {
      id: Date.now(),
      businessName: powerlistContactDetails?.companyName || 'Unknown Business',
      contactName: `${callDetails?.fname || ''} ${callDetails?.lname || ''}`.trim() || 'Unknown Contact',
      phone: data.phone || callDetails?.tonumber || callDetails?.fromnumber || '',
      address: address,
      email: powerlistContactDetails?.email || '',
      industry: industry,
      status: (data.disposition || 'note').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, ''),
      callDateTime: callDetails?.calldate || callDetails?.answerDate || new Date().toISOString(),
      duration: callDetails?.duration ? `${callDetails.duration} seconds` : 'N/A',
      notes: data.note || data.notes || '',
      agentName: callDetails?.calleridName || `${callDetails?.fname} ${callDetails?.lname}` || 'Unknown Agent',
      agentEmail: agentEmail,
      callType: callDetails?.calltype || 'outgoing',
      callStatus: callDetails?.callstatus || 'unknown',
      recordingUrl: callDetails?.recordingurl || '',
      kixieCallId: callDetails?.callid || data.callid || '',
      powerlistId: data.powerlistId || '',
      lastUpdated: new Date().toISOString()
    };

    // Validate and normalize status
    const validStatuses = ['interested', 'not-interested', 'followup', 'quoted', 'note', 'na', 'ivr', 'left-live-message', 'dnc'];
    if (!validStatuses.includes(processedLead.status)) {
      console.log(`Invalid status received: ${processedLead.status}, defaulting to 'note'`);
      processedLead.status = 'note';
    }

    console.log('Processed GoSpeeds lead:', JSON.stringify(processedLead, null, 2));

    // In production, you might want to:
    // 1. Store in a database (Supabase, Firebase, etc.)
    // 2. Send notifications to agents
    // 3. Trigger other workflows
    // 4. Log to external analytics

    // For now, return success - the frontend handles localStorage
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'GoSpeeds webhook processed successfully',
        leadId: processedLead.id,
        agent: agentEmail,
        businessName: processedLead.businessName,
        phone: processedLead.phone,
        status: processedLead.status,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('GoSpeeds webhook error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
