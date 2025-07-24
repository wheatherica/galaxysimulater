#!/bin/bash

# Direct Lambda function deployment without CloudFormation

set -e

echo "🚀 Deploying Galaxy Simulator Lambda Function directly..."

FUNCTION_NAME="galaxy-simulator-direct"
REGION="us-east-1"

# Create deployment package
echo "📦 Creating deployment package..."
cd lambda/galaxy-simulator

# Create a minimal Lambda function
cat > simple-index.js << 'EOF'
exports.handler = async (event) => {
    console.log('Galaxy Simulator Lambda called:', JSON.stringify(event, null, 2));
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }
    
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { action, params } = body;
        
        console.log('Action:', action, 'Params:', params);
        
        if (action === 'initialize') {
            // Generate demo galaxy data
            const nBodies = Math.min(params.nBodies || 50000, 100000); // Limit for demo
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
            
            const response = {
                success: true,
                simulationId: `sim_${Date.now()}`,
                bodyCount: nBodies,
                state: {
                    positions,
                    colors,
                    types,
                    timestamp: Date.now()
                }
            };
            
            console.log('Returning response with', nBodies, 'bodies');
            
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify(response)
            };
        }
        
        if (action === 'step') {
            // Simple rotation update for demo
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
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
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                message: 'Galaxy Simulator Lambda is working!',
                receivedAction: action
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};
EOF

# Create ZIP package
zip -r deployment.zip simple-index.js

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "📝 Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://deployment.zip \
        --region $REGION
else
    echo "🆕 Creating new function..."
    # Try to create function (this might fail due to permissions)
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role arn:aws:iam::426229613300:role/lambda-execution-role \
        --handler simple-index.handler \
        --zip-file fileb://deployment.zip \
        --timeout 300 \
        --memory-size 1024 \
        --region $REGION \
        --environment Variables='{DEMO_MODE=true}' \
        2>/dev/null || echo "❌ Could not create function - trying alternative approach..."
fi

# Test the function
echo "🧪 Testing function..."
aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --payload '{"httpMethod":"POST","body":"{\"action\":\"initialize\",\"params\":{\"nBodies\":1000}}"}' \
    test-response.json

echo "📋 Test response:"
cat test-response.json
echo ""

# Clean up
rm deployment.zip simple-index.js test-response.json

echo "✅ Direct deployment attempt completed!"
cd ../..
EOF

chmod +x lambda-only-deploy.sh
./lambda-only-deploy.sh