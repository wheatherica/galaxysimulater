exports.handler = async (event) => {
    console.log('Galaxy Simulator Test - Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: JSON.stringify({
            success: true,
            message: 'Galaxy Simulator Lambda is working!',
            timestamp: new Date().toISOString(),
            environment: process.env.AWS_REGION,
            version: '1.0.0'
        })
    };
};