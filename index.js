const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());
app.use(require('cors')());

// Instagram GraphQL API endpoint
const INSTAGRAM_API = 'https://www.instagram.com/p/{shortcode}/?__a=1&__d=dis';

app.get('/api/download', async (req, res) => {
    try {
        const postUrl = req.query.url;
        if (!postUrl) {
            return res.status(400).json({ error: 'Instagram URL is required as query parameter' });
        }

        // Extract shortcode from URL
        const shortcode = postUrl.match(/\/p\/([^\/?]+)/)?.[1];
        if (!shortcode) {
            return res.status(400).json({ error: 'Invalid Instagram URL' });
        }

        // Fetch data from Instagram API
        const apiUrl = INSTAGRAM_API.replace('{shortcode}', shortcode);
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const data = response.data;
        const mediaData = data.graphql.shortcode_media;

        // Parse media information
        const result = {
            id: mediaData.id,
            shortcode: mediaData.shortcode,
            caption: mediaData.edge_media_to_caption?.edges[0]?.node?.text || '',
            author: {
                id: mediaData.owner.id,
                username: mediaData.owner.username,
                full_name: mediaData.owner.full_name,
                profile_pic: mediaData.owner.profile_pic_url,
                is_verified: mediaData.owner.is_verified
            },
            dimensions: mediaData.dimensions,
            likes: mediaData.edge_media_preview_like?.count || 0,
            comments: mediaData.edge_media_to_comment?.count || 0,
            views: mediaData.video_view_count || null,
            timestamp: new Date(mediaData.taken_at_timestamp * 1000).toISOString(),
            is_video: mediaData.is_video,
            is_carousel: mediaData.media_type === 8,
            media: []
        };

        // Handle different media types
        if (result.is_carousel) {
            mediaData.edge_sidecar_to_children.edges.forEach(({ node }) => {
                const mediaItem = parseMediaItem(node);
                result.media.push(mediaItem);
            });
        } else {
            result.media.push(parseMediaItem(mediaData));
        }

        res.json(result);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch post data',
            details: error.message 
        });
    }
});

function parseMediaItem(node) {
    const isVideo = node.is_video;
    const mediaItem = {
        type: isVideo ? 'video' : 'image',
        url: isVideo ? 
            node.video_url : 
            node.display_url,
        thumbnail: node.thumbnail_src,
        dimensions: node.dimensions
    };
    
    if (isVideo) {
        mediaItem.video_duration = node.video_duration;
        mediaItem.audio = node.has_audio ? {
            audio_url: node.video_url,
            audio_duration: node.video_duration
        } : null;
    }
    
    return mediaItem;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
