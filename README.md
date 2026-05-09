# Dhyan's Website - Personal Portfolio & Tracker

Welcome to my personal corner of the web. This site serves as a central hub to showcase my personal interests, curated collections, and ongoing trackers.

## 🌟 About This Site

This platform is more than just a tracker; it's a window into what I value and how I spend my time. It features:

- **Inventory**: A curated showcase of my technology, wardrobe, and kitchen essentials.
- **Watchlist**: My personal tracking for TV shows and movies, including release schedules and progress monitoring.
- **Insights**: Collections of books, articles, and inspirations that shape my perspective.
- **Personal Touch**: A glimpse into my beliefs, favorite recipes, and photography.

## 🛠️ Technology Stack

- **Frontend**: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- **Backend & Auth**: Supabase
- **Data Integration**: TMDB API (for media metadata)

## 🚀 Getting Started

To run this project locally:

```sh
# Clone the repository
git clone https://github.com/DShyam3/DShyam3.github.io.git

# Install dependencies
npm i

# Start the development server
npm run dev
```

## 🔐 Environment Setup

Ensure you have a `.env.local` file with the following configurations:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TMDB_API_KEY`
- `VITE_TMDB_BASE_URL`
- `VITE_TMDB_IMAGE_BASE_URL`
- `VITE_ADMIN_PASSWORD`

If you are setting up this project from scratch or migrating to a new database, please refer to the [Supabase Integration Guide](SUPABASE_INTEGRATION.md) for details on recreating the necessary tables and storage buckets.

## ⚖️ License

MIT
