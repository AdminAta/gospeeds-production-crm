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
    
    console.log('GoSpeeds Webhook received:', JSON.stringify(webhookData, null, 2));

    // Extract data from Kixie's actual structure
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

    // Parse address and industry from ssData JSON (from powerlistContactDetails)
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
      // Fallback to powerlistContactSSData if ssData not available
      else if (data.powerlistContactSSData) {
        const ssData = JSON.parse(data.powerlistContactSSData);
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

    // Build contact name from firstName and lastName, or use title
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

    // Process the webhook data with Kixie's actual structure
    const processedLead = {
      id: Date.now(),
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
      lastUpdated: new Date().toISOString()
    };

    // Validate and normalize status
    const validStatuses = ['interested', 'not-interested', 'followup', 'quoted', 'note', 'na', 'ivr', 'left-live-message', 'dnc'];
    if (!validStatuses.includes(processedLead.status)) {
      console.log(`Status "${data.disposition}" normalized to "${processedLead.status}"`);
      // Try to map common Kixie dispositions
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
      
      processedLead.status = statusMapping[processedLead.status] || 'note';
    }

    console.log('Processed GoSpeeds lead:', JSON.stringify(processedLead, null, 2));

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'GoSpeeds webhook processed successfully',
        leadId: processedLead.id,
        agent: agentEmail,
        businessName: processedLead.businessName,
        contactName: processedLead.contactName,
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
