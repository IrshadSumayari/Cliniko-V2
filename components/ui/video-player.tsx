'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, ExternalLink } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  duration: string;
  thumbnailUrl?: string;
  className?: string;
}

export function VideoPlayer({ 
  videoId, 
  title, 
  duration, 
  thumbnailUrl,
  className = '' 
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handleOpenYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="p-0">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {isPlaying ? (
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg overflow-hidden group cursor-pointer" onClick={handlePlay}>
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-4xl font-bold mb-2">📹</div>
                    <div className="text-sm opacity-80">Tutorial Video</div>
                  </div>
                </div>
              )}
              
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" />
                </div>
              </div>

              {/* Duration Badge */}
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="bg-black/70 text-white border-0">
                  {duration}
                </Badge>
              </div>

              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <h3 className="text-white font-medium text-sm overflow-hidden" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>{title}</h3>
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons - Only show when not playing */}
        {!isPlaying && (
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Click to play inline
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenYouTube}
              className="text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Open in YouTube
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
