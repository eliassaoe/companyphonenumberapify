const { Actor } = require('apify');
const axios = require('axios');

Actor.main(async () => {
    console.log('📞 Company Phone Finder Actor Starting...');
    
    // Get input from Apify
    const input = await Actor.getInput();
    
    if (!input) {
        throw new Error('No input provided');
    }
    
    console.log('📝 Input received:', JSON.stringify(input, null, 2));
    
    // Extract parameters
    const {
        companyName, // For individual search
        country,
        phoneTypes = ['main', 'support', 'sales'],
        maxResults = 5,
        companyNames: companyNamesString, // For bulk processing (JSON string)
        type = 'individual' // individual or bulk
    } = input;
    
    // Parse companyNames if it's a string (JSON format)
    let companyNamesData = [];
    
    if (companyNamesString && type === 'bulk') {
        try {
            // Clean the companyNamesString first
            let cleanedContent = companyNamesString.trim();
            
            // Try to parse as JSON
            if (cleanedContent.startsWith('[')) {
                console.log('📊 Parsing as JSON format...');
                companyNamesData = JSON.parse(cleanedContent);
                if (!Array.isArray(companyNamesData)) {
                    throw new Error('JSON data must be an array');
                }
            } else {
                throw new Error('Company names must be in JSON array format');
            }
            
            console.log(`📊 Parsed ${companyNamesData.length} companies from input`);
            
        } catch (parseError) {
            console.error('Parse error details:', parseError.message);
            console.error('Content preview:', companyNamesString?.substring(0, 200) + '...');
            throw new Error('Invalid format: ' + parseError.message + '. Use JSON array format like ["Apple Inc", "Google"].');
        }
    }
    
    // Your webhook endpoint
    const WEBHOOK_URL = 'https://eliasse-n8n.onrender.com/webhook/phonefinder';
    
    let results = [];
    
    try {
        if (type === 'individual') {
            // Single company search
            if (!companyName) {
                throw new Error('companyName is required for individual search');
            }
            
            console.log(`📞 Finding phone numbers for: ${companyName}`);
            
            // Try multiple approaches to avoid 403 errors
            let response;
            const payloads = [
                // Try with your required format
                {
                    companyName: companyName,
                    country: country || null,
                    phoneTypes: phoneTypes,
                    maxResults: maxResults,
                    timestamp: new Date().toISOString(),
                    source: 'company-phone-finder',
                    version: '1.0.0'
                }
            ];
            
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Apify-Phone-Finder/1.0',
                'n8n-webhook-caller/1.0'
            ];
            
            let success = false;
            let attempts = 0;
            
            for (const payload of payloads) {
                if (success) break;
                
                for (const userAgent of userAgents) {
                    if (success) break;
                    attempts++;
                    
                    try {
                        console.log(`🔄 Attempt ${attempts}: Testing payload format`);
                        
                        response = await axios.post(WEBHOOK_URL, payload, {
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': userAgent,
                                'Accept': 'application/json',
                                'Cache-Control': 'no-cache'
                            },
                            timeout: 60000, // 1 minute timeout
                            validateStatus: function (status) {
                                return status < 500; // Don't throw on 4xx errors
                            }
                        });
                        
                        if (response.status === 200) {
                            console.log(`✅ Success with payload format and user agent: ${userAgent}`);
                            success = true;
                            break;
                        } else {
                            console.log(`⚠️ Got status ${response.status}, trying next approach`);
                        }
                        
                    } catch (error) {
                        console.log(`⚠️ Attempt ${attempts} failed: ${error.message}`);
                        if (attempts >= 3) { // Max attempts reached
                            throw error;
                        }
                        // Wait before next attempt
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (!success) {
                throw new Error(`All attempts failed. Last status: ${response?.status || 'No response'}`);
            }
            
            const phoneData = response.data;
            
            // Format result
            const result = {
                companyName: companyName,
                mainPhone: phoneData.phone || phoneData.phoneNumber || phoneData.mainPhone || null,
                phoneNumbers: phoneData.phoneNumbers || (phoneData.phone ? [{ type: 'main', number: phoneData.phone }] : []),
                companyInfo: {
                    name: companyName,
                    country: country || null,
                    searchedAt: new Date().toISOString(),
                    source: 'company-phone-finder',
                    verified: true
                },
                dataQuality: {
                    phoneNumbersFound: phoneData.phoneNumbers ? phoneData.phoneNumbers.length : (phoneData.phone ? 1 : 0),
                    confidence: phoneData.confidence || (phoneData.phone || phoneData.phoneNumber ? 'high' : 'low')
                },
                searchCriteria: {
                    phoneTypes: phoneTypes,
                    maxResults: maxResults,
                    country: country
                },
                processedAt: new Date().toISOString(),
                searchId: `individual_${Date.now()}`
            };
            
            results.push(result);
            
            console.log(`📞 Result: ${result.mainPhone || 'No phone found'}`);
            
        } else if (type === 'bulk') {
            // Bulk phone search
            if (!companyNamesData || !Array.isArray(companyNamesData)) {
                throw new Error('companyNames array is required for bulk processing');
            }
            
            console.log(`📦 Processing ${companyNamesData.length} companies for bulk phone finding...`);
            
            // Process companies individually
            let processedCount = 0;
            
            for (const currentCompanyName of companyNamesData) {
                try {
                    console.log(`📞 Processing: ${currentCompanyName}`);
                    
                    // Use the same retry logic as individual search
                    let response;
                    const payloads = [
                        // Try with your required format
                        {
                            companyName: currentCompanyName,
                            country: country || null,
                            phoneTypes: phoneTypes,
                            maxResults: maxResults,
                            timestamp: new Date().toISOString(),
                            source: 'company-phone-finder',
                            version: '1.0.0'
                        }
                    ];
                    
                    const userAgents = [
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Apify-Phone-Finder/1.0',
                        'n8n-webhook-caller/1.0'
                    ];
                    
                    let success = false;
                    let attempts = 0;
                    
                    for (const payload of payloads) {
                        if (success) break;
                        
                        for (const userAgent of userAgents) {
                            if (success) break;
                            attempts++;
                            
                            try {
                                console.log(`🔄 Bulk attempt ${attempts} for ${currentCompanyName}`);
                                
                                response = await axios.post(WEBHOOK_URL, payload, {
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'User-Agent': userAgent,
                                        'Accept': 'application/json',
                                        'Cache-Control': 'no-cache'
                                    },
                                    timeout: 60000, // 1 minute timeout
                                    validateStatus: function (status) {
                                        return status < 500; // Don't throw on 4xx errors
                                    }
                                });
                                
                                if (response.status === 200) {
                                    console.log(`✅ Success for ${currentCompanyName} with user agent: ${userAgent}`);
                                    success = true;
                                    break;
                                } else {
                                    console.log(`⚠️ Got status ${response.status} for ${currentCompanyName}, trying next approach`);
                                }
                                
                            } catch (error) {
                                console.log(`⚠️ Bulk attempt ${attempts} failed for ${currentCompanyName}: ${error.message}`);
                                if (attempts >= 3) { // Max attempts reached
                                    throw error;
                                }
                                // Wait before next attempt
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                    }
                    
                    if (!success) {
                        throw new Error(`All attempts failed for ${currentCompanyName}. Last status: ${response?.status || 'No response'}`);
                    }
                    
                    const phoneData = response.data;
                    
                    // Add result
                    const result = {
                        companyName: currentCompanyName,
                        mainPhone: phoneData.phone || phoneData.phoneNumber || phoneData.mainPhone || null,
                        phoneNumbers: phoneData.phoneNumbers || (phoneData.phone ? [{ type: 'main', number: phoneData.phone }] : []),
                        companyInfo: {
                            name: currentCompanyName,
                            country: country || null,
                            searchedAt: new Date().toISOString(),
                            source: 'company-phone-finder',
                            verified: true
                        },
                        dataQuality: {
                            phoneNumbersFound: phoneData.phoneNumbers ? phoneData.phoneNumbers.length : (phoneData.phone || phoneData.phoneNumber ? 1 : 0),
                            confidence: phoneData.confidence || (phoneData.phone || phoneData.phoneNumber ? 'high' : 'low')
                        },
                        processedAt: new Date().toISOString(),
                        searchId: `bulk_${Date.now()}_${processedCount}`
                    };
                    
                    results.push(result);
                    processedCount++;
                    
                    console.log(`📞 Result ${processedCount}/${companyNamesData.length}: ${result.mainPhone || 'No phone found'}`);
                    
                    // Small delay between requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (contactError) {
                    console.error(`❌ Error for ${currentCompanyName}:`, contactError.message);
                    
                    // Add error result
                    results.push({
                        companyName: currentCompanyName,
                        mainPhone: null,
                        phoneNumbers: [],
                        error: contactError.message,
                        processedAt: new Date().toISOString(),
                        searchId: `bulk_error_${Date.now()}_${processedCount}`
                    });
                    
                    processedCount++;
                }
            }
            
            console.log(`📊 Bulk processing complete: ${results.length} total results`);
        }
        
        // Always push results to dataset (even if empty for billing)
        if (results.length > 0) {
            await Actor.pushData(results);
            console.log(`✅ Saved ${results.length} results to dataset`);
        } else {
            // Push error item to prevent free usage
            await Actor.pushData([{
                error: 'No phone results generated',
                type: type,
                timestamp: new Date().toISOString(),
                inputData: { companyName, country, companyNamesLength: companyNamesData?.length }
            }]);
            console.log('⚠️ No results - saved error item');
        }
        
        // Generate summary statistics
        const phonesFound = results.filter(r => r.mainPhone && !r.error).length;
        const errors = results.filter(r => r.error).length;
        const successRate = results.length > 0 ? ((phonesFound / results.length) * 100).toFixed(1) : 0;
        
        const summary = {
            type: type,
            totalProcessed: results.length,
            phonesFound: phonesFound,
            errors: errors,
            successRate: successRate + '%',
            processedAt: new Date().toISOString()
        };
        
        console.log('📊 Final Summary:', JSON.stringify(summary, null, 2));
        
        // Save summary for actor insights
        await Actor.setValue('PHONE_FINDER_SUMMARY', summary);
        
    } catch (error) {
        console.error('❌ Actor error:', error.message);
        
        // Log detailed error information
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        
        // Push error to dataset to prevent free usage
        await Actor.pushData([{
            error: error.message,
            errorDetails: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            },
            type: type,
            timestamp: new Date().toISOString(),
            inputData: { companyName, country }
        }]);
        
        // Don't throw - let actor complete with error data
        console.log('💾 Error saved to dataset');
    }
    
    console.log('🏁 Company Phone Finder Actor Finished');
});
