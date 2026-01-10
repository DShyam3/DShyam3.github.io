-- Sample data for Books
INSERT INTO books (title, author, category, cover_url, description) VALUES
('Atomic Habits', 'James Clear', 'favourite', 'https://images-na.ssl-images-amazon.com/images/I/51Eqf-URhoL.jpg', 'Practical strategies for building good habits and breaking bad ones'),
('The Design of Everyday Things', 'Don Norman', 'favourite', 'https://images-na.ssl-images-amazon.com/images/I/416Hql52NCL.jpg', 'Essential reading for anyone interested in design and usability'),
('Sapiens', 'Yuval Noah Harari', 'favourite', 'https://images-na.ssl-images-amazon.com/images/I/41eUHP1YSOL.jpg', 'A brief history of humankind - mind-expanding perspective on human evolution'),
('The Lean Startup', 'Eric Ries', 'future', 'https://images-na.ssl-images-amazon.com/images/I/51Zymoq7UnL.jpg', 'Revolutionary approach to building and scaling startups'),
('Thinking, Fast and Slow', 'Daniel Kahneman', 'favourite', 'https://images-na.ssl-images-amazon.com/images/I/41shZGS-G+L.jpg', 'Fascinating insights into how we make decisions');

-- Sample data for Articles
INSERT INTO articles (title, author, link, category, notes) VALUES
('How to Do Great Work', 'Paul Graham', 'http://paulgraham.com/greatwork.html', 'articles', 'Timeless advice on pursuing meaningful work and achieving excellence'),
('The Tail End', 'Tim Urban', 'https://waitbutwhy.com/2015/12/the-tail-end.html', 'articles', 'Eye-opening perspective on time and relationships'),
('Maker''s Schedule, Manager''s Schedule', 'Paul Graham', 'http://paulgraham.com/makersschedule.html', 'articles', 'Why different types of work require different schedules'),
('The Importance of Deep Work', 'Cal Newport', 'https://calnewport.com/deep-work/', 'articles', 'How focused work creates disproportionate value'),
('First Principles Thinking', 'James Clear', 'https://jamesclear.com/first-principles', 'articles', 'Breaking down complex problems to their fundamental truths');

-- Sample data for Inspirations (People)
INSERT INTO inspirations (name, category, image_url, link, why_i_like) VALUES
('Paul Graham', 'entrepreneurs', 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Paulgraham_240x320.jpg', 'http://paulgraham.com', 'Co-founder of Y Combinator. His essays on startups and life are incredibly insightful'),
('Dieter Rams', 'artists-painters', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Dieter_Rams.jpg/440px-Dieter_Rams.jpg', 'https://www.vitsoe.com/us/about/dieter-rams', 'Legendary industrial designer. His 10 principles of good design are timeless'),
('Naval Ravikant', 'thinkers', 'https://pbs.twimg.com/profile_images/1417903307904532480/cYQqPCHm_400x400.jpg', 'https://nav.al', 'Deep thinker on wealth, happiness, and philosophy. The Almanack of Naval changed my perspective'),
('Casey Neistat', 'creators', 'https://yt3.googleusercontent.com/ytc/AIdro_kGRcWSZKz8xqcL6vSMdKpPKRWqHxqABJlCqALNjg=s176-c-k-c0x00ffffff-no-rj', 'https://www.youtube.com/@casey', 'Filmmaker and YouTuber who redefined vlogging and creative storytelling'),
('Jony Ive', 'artists-painters', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Jony_Ive_%28OTRS%29.jpg/440px-Jony_Ive_%28OTRS%29.jpg', 'https://en.wikipedia.org/wiki/Jony_Ive', 'Former Chief Design Officer at Apple. His obsession with simplicity and detail is inspiring');

-- Sample data for Recipes
INSERT INTO recipes (title, description, category, image_url, is_personal, ingredients, instructions) VALUES
('Pasta Aglio e Olio', 'Simple Italian pasta with garlic and olive oil', 'main', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400', true, 
'400g spaghetti
6 cloves garlic, thinly sliced
1/2 cup olive oil
1 tsp red pepper flakes
Fresh parsley
Parmesan cheese
Salt and pepper',
'1. Cook pasta in salted boiling water until al dente
2. Meanwhile, heat olive oil in a large pan
3. Add sliced garlic and red pepper flakes, cook until fragrant
4. Add cooked pasta to the pan with some pasta water
5. Toss everything together, add parsley
6. Serve with parmesan cheese'),

('Shakshuka', 'Middle Eastern eggs poached in tomato sauce', 'main', 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400', true,
'1 onion, diced
1 red bell pepper, diced
4 cloves garlic, minced
1 can crushed tomatoes
1 tsp cumin
1 tsp paprika
4-6 eggs
Feta cheese
Fresh cilantro
Olive oil',
'1. Sauté onion and bell pepper in olive oil
2. Add garlic and spices, cook for 1 minute
3. Add crushed tomatoes, simmer for 10 minutes
4. Make wells in the sauce and crack eggs into them
5. Cover and cook until eggs are set
6. Top with feta and cilantro'),

('Chocolate Chip Cookies', 'Classic chewy chocolate chip cookies', 'desserts', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400', true,
'2 1/4 cups flour
1 tsp baking soda
1 tsp salt
1 cup butter, softened
3/4 cup sugar
3/4 cup brown sugar
2 eggs
2 tsp vanilla
2 cups chocolate chips',
'1. Preheat oven to 375°F
2. Mix flour, baking soda, and salt
3. Beat butter and sugars until creamy
4. Add eggs and vanilla
5. Gradually add flour mixture
6. Fold in chocolate chips
7. Drop spoonfuls on baking sheet
8. Bake 9-11 minutes'),

('Avocado Toast', 'Quick and healthy breakfast', 'breakfast', 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400', true,
'2 slices sourdough bread
1 ripe avocado
1 tsp lemon juice
Red pepper flakes
Salt and pepper
Optional: poached egg, cherry tomatoes',
'1. Toast the bread until golden
2. Mash avocado with lemon juice, salt, and pepper
3. Spread avocado on toast
4. Top with red pepper flakes
5. Optional: add poached egg and tomatoes'),

('Banana Smoothie', 'Creamy and energizing breakfast smoothie', 'breakfast', 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400', true,
'2 ripe bananas
1 cup milk (or almond milk)
1/2 cup Greek yogurt
1 tbsp honey
1/2 tsp vanilla
Ice cubes
Optional: peanut butter, oats',
'1. Add all ingredients to blender
2. Blend until smooth and creamy
3. Add ice for desired thickness
4. Pour into glass and enjoy');
