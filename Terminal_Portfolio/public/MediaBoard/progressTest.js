// Test file to demonstrate improved progress tracking

// Simulate the MediaUpdateService for testing
class MockMediaUpdateService {
    constructor() {
        this.batchSize = 5;
        this.maxConcurrentRequests = 3;
        this.rateLimitDelay = 100;
    }

    // Mock the processBatchParallel method to test progress
    async processBatchParallel(items, processor, batchSize = this.batchSize, maxConcurrent = this.maxConcurrentRequests, onProgress = null) {
        const results = [];
        const batches = [];
        
        // Split items into batches
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        
        console.log(`Processing ${items.length} items in ${batches.length} batches of ${batchSize} with max ${maxConcurrent} concurrent requests`);
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Process batch with limited concurrency
            const batchPromises = batch.map(item => processor(item));
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Collect results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.error(`Error processing item in batch ${batchIndex + 1}:`, result.reason);
                    results.push(null);
                }
            });
            
            // Update progress after each batch
            if (onProgress) {
                const batchProgress = ((batchIndex + 1) / batches.length) * 100;
                onProgress(Math.round(batchProgress));
            }
            
            // Rate limiting between batches (except for the last batch)
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
            }
        }
        
        return results.filter(result => result !== null);
    }

    // Mock the checkForUpdates method to test overall progress
    async checkForUpdates(forceCheck = false, checkPlatforms = false, onProgress = null) {
        try {
            console.log('🚀 Starting mock update check...');
            
            if (onProgress) onProgress(0); // Start at 0%

            // Simulate TV show updates (30% of total progress)
            console.log('📺 Starting TV show updates...');
            if (onProgress) onProgress(10); // Start at 10%
            
            const mockShows = Array.from({length: 15}, (_, i) => `Show ${i + 1}`);
            await this.processBatchParallel(
                mockShows,
                async (show) => {
                    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
                    return `updated_${show}`;
                },
                5, 3, 100,
                (progress) => {
                    if (onProgress) {
                        // TV shows are 30% of total progress (10% to 40%)
                        const tvProgress = 10 + (progress * 0.3);
                        onProgress(Math.round(tvProgress));
                    }
                }
            );

            // Simulate movie updates (50% of total progress)
            console.log('🎬 Starting movie updates...');
            if (onProgress) onProgress(40); // Movies start at 40%
            
            const mockMovies = Array.from({length: 25}, (_, i) => `Movie ${i + 1}`);
            await this.processBatchParallel(
                mockMovies,
                async (movie) => {
                    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
                    return `updated_${movie}`;
                },
                5, 3, 100,
                (progress) => {
                    if (onProgress) {
                        // Movies are 50% of total progress (40% to 90%)
                        const movieProgress = 40 + (progress * 0.5);
                        onProgress(Math.round(movieProgress));
                    }
                }
            );

            // Simulate coming soon panel update
            console.log('📅 Updating coming soon panel...');
            if (onProgress) onProgress(90);
            await new Promise(resolve => setTimeout(resolve, 300));

            // Simulate newly released movies check
            console.log('🎭 Checking newly released movies...');
            if (onProgress) onProgress(95);
            await new Promise(resolve => setTimeout(resolve, 200));

            console.log('✅ Update check complete');
            if (onProgress) onProgress(100); // Complete

            return [];
        } catch (error) {
            console.error('❌ Error in update check:', error);
            throw error;
        }
    }

    // Mock the refreshAllMoviesParallel method
    async refreshAllMoviesParallel(onProgress = null) {
        try {
            console.log('🚀 Starting mock movie refresh...');
            
            const mockMovies = Array.from({length: 20}, (_, i) => `Movie ${i + 1}`);
            
            if (!mockMovies || mockMovies.length === 0) {
                console.log('✅ No movies found to refresh');
                if (onProgress) onProgress(100);
                return { updated: 0, errors: 0, total: 0 };
            }

            console.log(`📊 Found ${mockMovies.length} movies to refresh`);
            
            const results = await this.processBatchParallel(
                mockMovies,
                async (movie) => {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
                    return Math.random() > 0.1; // 90% success rate
                },
                5, 3, 100,
                onProgress
            );
            
            const totalUpdated = results.filter(result => result === true).length;
            const totalErrors = results.filter(result => result === false).length;
            
            console.log('🎉 Movie refresh completed!');
            console.log(`📈 Summary: ${totalUpdated} updated, ${totalErrors} errors out of ${mockMovies.length} total`);
            
            return {
                updated: totalUpdated,
                errors: totalErrors,
                total: mockMovies.length
            };
            
        } catch (error) {
            console.error('💥 Error in movie refresh:', error);
            throw error;
        }
    }
}

// Test functions
async function testProgressTracking() {
    console.log('🧪 Testing progress tracking...\n');
    
    const mockService = new MockMediaUpdateService();
    
    // Test 1: Overall update progress
    console.log('📊 Test 1: Overall update progress');
    console.log('=' .repeat(50));
    await mockService.checkForUpdates(true, true, (progress) => {
        console.log(`📈 Overall Progress: ${progress}%`);
    });
    
    console.log('\n' + '=' .repeat(50) + '\n');
    
    // Test 2: Movie refresh progress
    console.log('📊 Test 2: Movie refresh progress');
    console.log('=' .repeat(50));
    await mockService.refreshAllMoviesParallel((progress) => {
        console.log(`📈 Refresh Progress: ${progress}%`);
    });
    
    console.log('\n✅ Progress tracking test completed!');
}

async function testBatchProgress() {
    console.log('🧪 Testing batch progress...\n');
    
    const mockService = new MockMediaUpdateService();
    
    const items = Array.from({length: 12}, (_, i) => `Item ${i + 1}`);
    
    console.log('📦 Testing batch processing with progress');
    console.log('=' .repeat(50));
    
    const results = await mockService.processBatchParallel(
        items,
        async (item) => {
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
            return `processed_${item}`;
        },
        3, 2, 150,
        (progress) => {
            console.log(`📈 Batch Progress: ${progress}%`);
        }
    );
    
    console.log(`\n✅ Batch processing completed! Processed ${results.length} items`);
}

// Run tests
async function runAllTests() {
    try {
        await testProgressTracking();
        console.log('\n' + '=' .repeat(50) + '\n');
        await testBatchProgress();
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MockMediaUpdateService,
        testProgressTracking,
        testBatchProgress,
        runAllTests
    };
}

// Auto-run if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
    runAllTests();
}

// Usage examples:
// 
// 1. Test progress tracking:
//    await testProgressTracking();
//
// 2. Test batch progress:
//    await testBatchProgress();
//
// 3. Run all tests:
//    await runAllTests();
