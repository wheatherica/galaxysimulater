// Minimal Lambda function for Galaxy Simulator
exports.handler = async (event) => {
    console.log('Galaxy Simulator Lambda called:', JSON.stringify(event, null, 2));
    
    // Handle CORS preflight
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    try {
        let body = {};
        if (event.body) {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        }
        
        const { action, params } = body;
        
        console.log('Action:', action, 'Params:', params);
        
        if (action === 'initialize') {
            // Generate demo galaxy data
            const nBodies = Math.min(params?.nBodies || 50000, 100000);
            const positions = [];
            const colors = [];
            const types = [];
            
            console.log('Generating', nBodies, 'bodies...');
            
            for (let i = 0; i < nBodies; i++) {
                const r = Math.random() * 50;
                const theta = Math.random() * 2 * Math.PI;
                const z = (Math.random() - 0.5) * 4;
                
                positions.push([
                    r * Math.cos(theta),
                    r * Math.sin(theta),
                    z
                ]);
                
                const distanceColor = Math.min(1, r / 30);
                colors.push([
                    0.1 + distanceColor * 0.2,
                    0.08 + distanceColor * 0.1,
                    0.08 + distanceColor * 0.1
                ]);
                
                types.push(i < nBodies * 0.1 ? 'halo' : i < nBodies * 0.25 ? 'bulge' : 'disk');
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    simulationId: `sim_${Date.now()}`,
                    bodyCount: nBodies,
                    state: {
                        positions,
                        colors,
                        types,
                        timestamp: Date.now()
                    }
                })
            };
        }
        
        if (action === 'step') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    simulationId: body.simulationId,
                    state: {
                        positions: [],
                        colors: [],
                        types: [],
                        timestamp: Date.now()
                    }
                })
            };
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Galaxy Simulator Lambda is working!',
                receivedAction: action,
                timestamp: Date.now()
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};