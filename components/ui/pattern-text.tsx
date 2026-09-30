import React from 'react';
import { cn } from '@/lib/utils';

export function PatternText({
	text = 'Text',
	className,
	...props
}: Omit<React.ComponentProps<'p'>, 'children'> & { text: string }) {
	return (
		<p
			data-shadow={text}
			className={cn(
				'relative inline-block text-[10em] font-bold',
				'[text-shadow:0.02em_0.02em_0_hsl(var(--background))]',
				'after:absolute after:top-2 after:left-2 after:-z-10 after:content-[attr(data-shadow)]',
				'after:bg-[length:0.05em_0.05em] after:bg-clip-text after:text-transparent after:[text-shadow:none]',
				'after:bg-[linear-gradient(45deg,transparent_45%,hsl(var(--foreground))_45%,hsl(var(--foreground))_55%,transparent_0)]',
				'after:animate-shadanim',
				className,
			)}
			{...props}
		>
			{text}
		</p>
	);
}
