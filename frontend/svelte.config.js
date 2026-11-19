import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({ pages: 'dist' }),
    paths: { base: process.env.BASE_PATH ?? '' }
  }
};
