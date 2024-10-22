const express = require('express');
const axios = require('axios');
const { URL } = require('url');

const app = express();
app.use(express.json());
app.set('json spaces', 2);
const PORT = 3000;

// Function to clean Instagram URL and fetch JSON data
function cleanInstagramUrl(url) {
    const urlObj = new URL(url);
    urlObj.searchParams.set('__a', '1');
    urlObj.searchParams.set('__d', 'dis');
    return urlObj.toString();
}

// Helper function to extract media URLs (handles single and multiple media cases)
function extractMediaUrls(post) {
    let mediaItems = [];

    if (post.edge_sidecar_to_children) {
        // If the post is a carousel, loop through each media item
        post.edge_sidecar_to_children.edges.forEach(edge => {
            const media = edge.node;
            mediaItems.push({
                id: media.id,
                media_type: media.is_video ? 'video' : 'image',
                media_url: media.is_video ? media.video_url : media.display_url,
            });
        });
    } else {
        // If it's a single media post (image or video)
        mediaItems.push({
            id: post.id,
            media_type: post.is_video ? 'video' : 'image',
            media_url: post.is_video ? post.video_url : post.display_url,
        });
    }

    return mediaItems;
}

// Helper function to extract relevant data from the Instagram JSON
function extractInstagramData(json) {
    const graphql = json.graphql;
    const post = graphql.shortcode_media;

    return {
        id: post.id,
        media_items: extractMediaUrls(post),
        caption: post.edge_media_to_caption.edges[0]?.node.text || '',
        like_count: post.edge_media_preview_like.count,
        view_count: post.is_video ? post.video_view_count : null,
        owner_username: post.owner.username,
        owner_profile_pic: post.owner.profile_pic_url,
        timestamp: post.taken_at_timestamp
    };
}

// API route to fetch Instagram post/reel data
app.get('/api/instagram', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    try {
        // Clean the Instagram URL to add necessary query parameters
        const cleanedUrl = cleanInstagramUrl(url);

        // Set up headers to mimic a real user request
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.instagram.com/',
            'Accept-Language': 'en-US,en;q=0.9',
            'X-Requested-With': 'XMLHttpRequest',
            // Optionally, you can include session cookies here if required
            // 'Cookie': 'sessionid=YOUR_SESSION_ID; csrftoken=YOUR_CSRF_TOKEN; ...'
        };

        // Fetch Instagram post JSON data with headers
        const response = await axios.get(cleanedUrl, { headers });
        const instagramJson = response.data;

        // Extract only the necessary data from the Instagram JSON
        const extractedData = extractInstagramData(instagramJson);

        // Return the cleaned data
        res.json(extractedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching data from Instagram' });
    }
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
