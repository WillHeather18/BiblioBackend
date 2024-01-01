import sys
import json
import pandas as pd
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix



# Load the datasets
books_df = pd.read_csv('ML/Datasets/Books.csv', encoding='ISO-8859-1', low_memory=False)
ratings_df = pd.read_csv('ML/Datasets/Ratings.csv', encoding='ISO-8859-1')
users_df = pd.read_csv('ML/Datasets/Users.csv', encoding='ISO-8859-1')

ratings_df['User-ID'] = ratings_df['User-ID'].astype('int32')
ratings_df['Book-Rating'] = ratings_df['Book-Rating'].astype('int32')


# Data Preprocessing
# Handling missing and unrealistic values in 'books_df' and 'users_df'
books_df['Book-Author'].fillna('Unknown', inplace=True)
books_df['Publisher'].fillna('Unknown', inplace=True)
books_df['Year-Of-Publication'] = pd.to_numeric(books_df['Year-Of-Publication'], errors='coerce')
median_age = users_df['Age'].median()
users_df['Age'].fillna(median_age, inplace=True)
users_df['Age'] = users_df['Age'].apply(lambda x: median_age if x > 100 or x < 5 else x)

# Feature Engineering
# User-Based Features
user_avg_rating = ratings_df.groupby('User-ID')['Book-Rating'].mean().rename('Avg-User-Rating')
user_rating_count = ratings_df.groupby('User-ID')['Book-Rating'].count().rename('User-Rating-Count')
users_df = users_df.join(user_avg_rating, on='User-ID')
users_df = users_df.join(user_rating_count, on='User-ID')
users_df['Avg-User-Rating'].fillna(users_df['Avg-User-Rating'].median(), inplace=True)
users_df['User-Rating-Count'].fillna(0, inplace=True)

# Item-Based Features
author_book_count = books_df.groupby('Book-Author')['ISBN'].count().rename('Author-Book-Count')
publisher_book_count = books_df.groupby('Publisher')['ISBN'].count().rename('Publisher-Book-Count')
books_df = books_df.join(author_book_count, on='Book-Author')
books_df = books_df.join(publisher_book_count, on='Publisher')
book_avg_rating = ratings_df.groupby('ISBN')['Book-Rating'].mean().rename('Avg-Book-Rating')
book_rating_count = ratings_df.groupby('ISBN')['Book-Rating'].count().rename('Book-Rating-Count')
books_df = books_df.join(book_avg_rating, on='ISBN')
books_df = books_df.join(book_rating_count, on='ISBN')
books_df['Avg-Book-Rating'].fillna(books_df['Avg-Book-Rating'].median(), inplace=True)
books_df['Book-Rating-Count'].fillna(0, inplace=True)


min_book_ratings = 50
min_user_ratings = 50

filtered_books = ratings_df['ISBN'].value_counts() >= min_book_ratings
filtered_books = filtered_books[filtered_books].index.tolist()

filtered_users = ratings_df['User-ID'].value_counts() >= min_user_ratings
filtered_users = filtered_users[filtered_users].index.tolist()

ratings_df = ratings_df[(ratings_df['ISBN'].isin(filtered_books)) & (ratings_df['User-ID'].isin(filtered_users))]

# Collaborative Filtering
# Creating a pivot table
pivot_table = ratings_df.pivot_table(index='User-ID', columns='ISBN', values='Book-Rating', fill_value=0, aggfunc='sum')
pivot_table_sparse = pivot_table.astype(pd.SparseDtype("float", 0))
pivot_table_sparse_matrix = csr_matrix(pivot_table_sparse.sparse.to_coo())
U, sigma, Vt = svds(pivot_table_sparse_matrix, k=50)
sigma = np.diag(sigma)
predicted_ratings = np.dot(np.dot(U, sigma), Vt)
predicted_ratings_df = pd.DataFrame(predicted_ratings, index=pivot_table.index, columns=pivot_table.columns)

# Content-Based Filtering
# Text Preprocessing and Feature Extraction
books_df['Combined_Features'] = books_df['Book-Title'].str.lower() + " " + books_df['Book-Author'].str.lower() + " " + books_df['Publisher'].str.lower()
tfidf_vectorizer = TfidfVectorizer(stop_words='english')
tfidf_matrix = tfidf_vectorizer.fit_transform(books_df['Combined_Features'])
# Using NearestNeighbors
model_knn = NearestNeighbors(metric='cosine', algorithm='brute', n_neighbors=10, n_jobs=1)
model_knn.fit(tfidf_matrix)


def recommend_books_for_new_user(book_ratings, num_recommendations=10):
    # Create a unique pseudo user ID
    pseudo_user_id = max(ratings_df['User-ID']) + 1  # Ensure it's a new ID

    # Add the pseudo user's book ratings to the ratings DataFrame
    new_ratings = pd.DataFrame({'User-ID': pseudo_user_id, 'ISBN': list(book_ratings.keys()), 'Book-Rating': list(book_ratings.values())})
    updated_ratings_df = pd.concat([ratings_df, new_ratings], ignore_index=True)

    # Update the pivot table for collaborative filtering
    updated_pivot_table = updated_ratings_df.pivot_table(index='User-ID', columns='ISBN', values='Book-Rating', fill_value=0)
    updated_pivot_table_sparse = updated_pivot_table.astype(pd.SparseDtype("float", 0))
    updated_pivot_table_sparse_matrix = csr_matrix(updated_pivot_table_sparse.sparse.to_coo())

    # Recompute SVD
    U, sigma, Vt = svds(updated_pivot_table_sparse_matrix, k=50)
    sigma = np.diag(sigma)
    updated_predicted_ratings = np.dot(np.dot(U, sigma), Vt)
    updated_predicted_ratings_df = pd.DataFrame(updated_predicted_ratings, index=updated_pivot_table.index, columns=updated_pivot_table.columns)

    # Predict ratings for the pseudo user
    pseudo_user_ratings = updated_predicted_ratings_df.loc[pseudo_user_id].sort_values(ascending=False)
    
    # Remove books already rated by the user
    pseudo_user_ratings = pseudo_user_ratings.drop(labels=book_ratings.keys(), errors='ignore')

    # Get top recommendations based on remaining ratings
    top_recommendations = pseudo_user_ratings.head(num_recommendations)
    similar_books = pd.DataFrame()
    
    for isbn in top_recommendations.index:
        if isbn in books_df['ISBN'].values:
            book_idx = books_df.index[books_df['ISBN'] == isbn].tolist()[0]
            distances, indices = model_knn.kneighbors(tfidf_matrix.getrow(book_idx), n_neighbors=num_recommendations)
            
            for neighbor_idx in indices.flatten():
                similar_book = books_df.iloc[neighbor_idx]
                similar_book = similar_book.to_frame().T  # Convert Series to DataFrame

                if 'ISBN' not in similar_books or similar_book['ISBN'].iloc[0] not in similar_books['ISBN'].values:
                    similar_books = pd.concat([similar_books, similar_book], ignore_index=True)

    similar_books = similar_books.drop_duplicates('ISBN')
    similar_books['Predicted-Rating'] = similar_books['ISBN'].apply(lambda x: top_recommendations.get(x, 0))
    final_recommendations = similar_books.sort_values(by='Predicted-Rating', ascending=False).head(num_recommendations)
    
    return final_recommendations['ISBN'].tolist()

def parse_command_line_arguments():
    """
    Parses command line arguments for book ratings and the number of recommendations.
    The expected format is a JSON string for book ratings followed by an integer for the number of recommendations.
    Example: 'python script.py "{\"0747532745\": 10, \"0439064864\": 9, \"1408855674\": 10}" 5'
    """
    if len(sys.argv) != 3:
        raise ValueError("Please provide book ratings as a JSON string and the number of recommendations as an integer.")
    
    try:
        book_ratings = json.loads(sys.argv[1])
        num_recommendations = int(sys.argv[2])
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format for book ratings.")
    except ValueError:
        raise ValueError("The number of recommendations should be an integer.")
    
    return book_ratings, num_recommendations

if __name__ == "__main__":
    # Parse book ratings and number of recommendations from command line arguments
    book_ratings, num_recommendations = parse_command_line_arguments()
    
    # Generate recommendations
    recommendations = recommend_books_for_new_user(book_ratings, num_recommendations=num_recommendations)
    
    print(recommendations)



