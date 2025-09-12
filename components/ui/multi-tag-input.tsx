'use client';

import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';

interface MultiTagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  description?: string;
  maxTags?: number;
  className?: string;
}

export function MultiTagInput({
  tags,
  onTagsChange,
  placeholder = "Type and press Enter to add tags",
  label,
  description,
  maxTags = 10,
  className = "",
}: MultiTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  
  // Ensure tags is always an array
  const safeTags = Array.isArray(tags) ? tags : [];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && safeTags.length > 0) {
      // Remove last tag if input is empty and backspace is pressed
      removeTag(safeTags.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    
    if (trimmedValue && !safeTags.includes(trimmedValue) && safeTags.length < maxTags) {
      onTagsChange([...safeTags, trimmedValue]);
      setInputValue('');
    }
  };

  const removeTag = (indexToRemove: number) => {
    onTagsChange(safeTags.filter((_, index) => index !== indexToRemove));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="text-sm font-medium block">
          {label}
        </label>
      )}
      
      <div className="space-y-2">
        {/* Tags Display */}
        {safeTags.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg bg-muted/30">
            {safeTags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1 text-sm"
              >
                {tag}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeTag(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input Field */}
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1"
            disabled={safeTags.length >= maxTags}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTag}
            disabled={!inputValue.trim() || safeTags.includes(inputValue.trim()) || safeTags.length >= maxTags}
            className="px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {safeTags.length >= maxTags && (
        <p className="text-xs text-warning">
          Maximum {maxTags} tags allowed
        </p>
      )}
    </div>
  );
}
