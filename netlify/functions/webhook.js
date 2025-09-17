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
      statusCode: 405, 
      headers,
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
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'No agent email' }) 
      };
    }

    // Validate agent
    const validAgents = [
      'umar@gospeeds.com', 
      'ata@gospeeds.com', 
      'matthew@gospeeds.com', 
      'bilal@gospeeds.com', 
      'raheem@gospeeds.com', 
      'shamail@gospeeds.com'
    ];
    
    if (!validAgents.includes(agentEmail)) {
      console.log('ERROR: Invalid agent:', agentEmail);
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Invalid agent' }) 
      };
    }

    // Parse address and industry
    let address = '';
    let industry = '';
    try {
      let ssData = {};
      if (powerlistContactDetails?.ssData) {
        ssData = JSON.parse(powerlistContactDetails.ssData);
      } else if (data?.powerlistContactSSData) {
        ssData = JSON.parse(data.powerlistContactSSData);
      }
      
      address = [
        ssData['Street Address'], 
        ssData.City, 
        ssData.State, 
        ssData.Zipcode
      ].filter(Boolean).join(', ');
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
    if (!contactName) {
      contactName = 'Unknown Contact';
    }

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
    processedLead.status = statusMap[processedLead.status] || 'note';

    console.log('=== PROCESSED LEAD ===');
    console.log('Business:', processedLead.businessName);
    console.log('Contact:', processedLead.contactName);
    console.log('Phone:', processedLead.phone);
    console.log('Status:', processedLead.status);
    console.log('Agent:', processedLead.agentEmail);
    console.log('=== END PROCESSED ===');

    // Store in Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(processedLead)
        });

        if (supabaseResponse.ok) {
          console.log('Lead stored in Supabase successfully');
        } else {
          console.error('Supabase storage failed:', await supabaseResponse.text());
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Lead processed successfully',
        lead: processedLead,
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
};
