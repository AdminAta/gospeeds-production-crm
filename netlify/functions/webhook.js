// netlify/functions/webhook.js
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405, headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const webhookData = JSON.parse(event.body);
    
    console.log('=== GOSPEEDS WEBHOOK START ===');
    console.log('Full webhook data:', JSON.stringify(webhookData, null, 2));

    const data = webhookData.data;
    const callDetails = data?.callDetails;
    const powerlistContactDetails = data?.powerlistContactDetails?.result;
    const agentEmail = callDetails?.email;
    
    console.log('Agent email:', agentEmail);
    console.log('Business name:', powerlistContactDetails?.companyName);
    console.log('Disposition:', data?.disposition);

    if (!agentEmail) {
      console.log('ERROR: No agent email found');
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No agent email' }) };
    }

    // Validate agent
    const validAgents = ['umar@gospeeds.com', 'ata@gospeeds.com', 'matthew@gospeeds.com', 'bilal@gospeeds.com', 'raheem@gospeeds.com', 'shamail@gospeeds.com'];
    
    if (!validAgents.includes(agentEmail)) {
      console.log('ERROR: Invalid agent:', agentEmail);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid agent' }) };
    }

    // Parse address and industry
    let address = '', industry = '';
    try {
      let ssData = {};
      if (powerlistContactDetails?.ssData) {
        ssData = JSON.parse(powerlistContactDetails.ssData);
      } else if (data?.powerlistContactSSData) {
        ssData = JSON.parse(data.powerlistContactSSData);
      }
      
      address = [ssData['Street Address'], ssData.City, ssData.State, ssData.Zipcode].filter(Boolean).join(', ');
      industry = ssData.Industry || '';
    } catch (e) {
      console.log('Address parsing error:', e.message);
    }

    // Build contact name
    let contactName = '';
    if (powerlistContactDetails?.firstName || powerlistContactDetails?.lastName) {
      contactName = `${powerlistContactDetails.firstName || ''} ${powerlistContactDetails.lastName || ''}`.trim();
    }
    if (!contactName && powerlistContactDetails?.title) {
      contactName = powerlistContactDetails.title;
    }
    if (!contactName) contactName = 'Unknown Contact';

    // Create lead object
    const processedLead = {
      id: Date.now(),
      businessName: powerlistContactDetails?.companyName || 'Unknown Business',
      contactName: contactName,
      phone: data?.phone || data?.customernumber || callDetails?.tonumber || '',
      address: address,
      email: powerlistContactDetails?.email || '',
      industry: industry,
      title: powerlistContactDetails?.title || '',
      status: (data?.disposition || 'Note').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, ''),
      callDateTime: callDetails?.calldate || new Date().toISOString(),
      duration: callDetails?.duration ? `${callDetails.duration} seconds` : 'N/A',
      notes: data?.note || '',
      agentName: callDetails?.calleridName || 'Unknown Agent',
      agentEmail: agentEmail,
      callType: callDetails?.calltype || 'outgoing',
      callStatus: callDetails?.callstatus || 'unknown',
      recordingUrl: callDetails?.recordingurl || '',
      kixieCallId: callDetails?.callid || data?.callid || data?.externalid || '',
      timestamp: new Date().toISOString()
    };

    // Normalize status
    const statusMap = {
      'left-live-message': 'left-live-message', 'leftlivemessage': 'left-live-message',
      'not-interested': 'not-interested', 'notinterested': 'not-interested',
      'follow-up': 'followup', 'followup': 'followup', 'interested': 'interested',
      'quoted': 'quoted', 'note': 'note', 'na': 'na', 'n/a': 'na',
      'ivr': 'ivr', 'dnc': 'dnc', 'do-not-call': 'dnc'
    };
    processedLead.status = statusMap[processedLead.status] || 'note';

    console.log('=== PROCESSED LEAD ===');
    console.log('Business:', processedLead.businessName);
    console.log('Contact:', processedLead.contactName);
    console.log('Phone:', processedLead.phone);
    console.log('Status:', processedLead.status);
    console.log('Agent:', processedLead.agentEmail);
    console.log('=== END PROCESSED ===');

    // Return the lead data in response body
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Lead processed successfully',
        lead: processedLead, // Include full lead data
    // Return the lead data in response body
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Lead processed successfully',
        lead: processedLead, // Include full lead data
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Processing failed',
        message: error.message
      })
    };
  }
};// netlify/functions/webhook.js
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control// netlify/functions/webhook.js
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
    
    console.log('==== GOSPEEDS WEBHOOK RECEIVED ====');
    console.log(JSON.stringify(webhookData, null, 2));
    console.log('==== END WEBHOOK DATA ====');

    // Extract data from Kixie's actual structure
    const data = webhookData.data;
    if (!data) {
      console.log('ERROR: No data object found in webhook');
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
      console.log('ERROR: No agent email found in webhook data');
      console.log('callDetails:', JSON.stringify(callDetails, null, 2));
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing agent email in callDetails' })
      };
    }

    console.log(`Processing webhook for agent: ${agentEmail}`);

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
      console.log(`ERROR: Invalid agent email: ${agentEmail}`);
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
      let ssData = {};
      if (powerlistContactDetails?.ssData) {
        ssData = JSON.parse(powerlistContactDetails.ssData);
        console.log('Parsed ssData from powerlistContactDetails:', ssData);
      } else if (data.powerlistContactSSData) {
        ssData = JSON.parse(data.powerlistContactSSData);
        console.log('Parsed ssData from powerlistContactSSData:', ssData);
      }
      
      if (ssData['Street Address'] || ssData.City || ssData.State) {
        address = [
          ssData['Street Address'],
          ssData.City,
          ssData.State,
          ssData.Zipcode
        ].filter(Boolean).join(', ');
      }
      industry = ssData.Industry || '';
    } catch (e) {
      console.log('Could not parse ssData:', e);
    }

    // Build contact name from firstName, lastName, or title
    let contactName = '';
    if (powerlistContactDetails?.firstName || powerlistContactDetails?.lastName) {
      contactName = `${powerlistContactDetails.firstName || ''} ${powerlistContactDetails.lastName || ''}`.trim();
    }
    if (!contactName && powerlistContactDetails?.title) {
      contactName = powerlistContactDetails.title;
    }
    if (!contactName) {
      contactName = 'Unknown Contact';
    }

    // Process the webhook data
    const processedLead = {
      id: Date.now() + Math.random(),
      businessName: powerlistContactDetails?.companyName || 'Unknown Business',
      contactName: contactName,
      phone: data.phone || data.number || data.customernumber || callDetails?.tonumber || '',
      address: address,
      email: powerlistContactDetails?.email || '',
      industry: industry,
      title: powerlistContactDetails?.title || '',
      status: (data.disposition || 'note').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, ''),
      callDateTime: callDetails?.calldate || callDetails?.answerDate || new Date().toISOString(),
      duration: callDetails?.duration ? `${callDetails.duration} seconds` : 'N/A',
      notes: data.note || data.notes || '',
      agentName: callDetails?.calleridName || `${callDetails?.fname} ${callDetails?.lname}` || 'Unknown Agent',
      agentEmail: agentEmail,
      callType: callDetails?.calltype || data.callType || 'outgoing',
      callStatus: callDetails?.callstatus || 'unknown',
      recordingUrl: callDetails?.recordingurl || '',
      kixieCallId: callDetails?.callid || data.callid || data.externalid || '',
      powerlistId: data.powerlistId || '',
      phoneNumber164: powerlistContactDetails?.phoneNumber164 || data.customernumber || '',
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Validate and normalize status
    const validStatuses = ['interested', 'not-interested', 'followup', 'quoted', 'note', 'na', 'ivr', 'left-live-message', 'dnc'];
    if (!validStatuses.includes(processedLead.status)) {
      const statusMapping = {
        'left-live-message': 'left-live-message',
        'leftlivemessage': 'left-live-message',
        'not-interested': 'not-interested',
        'notinterested': 'not-interested',
        'follow-up': 'followup',
        'followup': 'followup',
        'interested': 'interested',
        'quoted': 'quoted',
        'note': 'note',
        'na': 'na',
        'n/a': 'na',
        'ivr': 'ivr',
        'dnc': 'dnc',
        'do-not-call': 'dnc'
      };
      
      const originalStatus = processedLead.status;
      processedLead.status = statusMapping[processedLead.status] || 'note';
      console.log(`Status mapped: "${originalStatus}" -> "${processedLead.status}"`);
    }

    console.log('==== PROCESSED LEAD ====');
    console.log(JSON.stringify(processedLead, null, 2));
    console.log('==== END PROCESSED LEAD ====');

    // Instead of storing server-side, we'll return the data for frontend processing
    // The frontend will need to poll this data or use a different approach

    // Return success response with the processed lead data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'GoSpeeds webhook processed successfully',
        lead: processedLead, // Include the full lead data
        agent: agentEmail,
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
