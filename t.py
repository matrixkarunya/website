import sqlite3, pandas as pd
con = sqlite3.connect("database.sqlite")
r = pd.read_sql_query("""SELECT player_api_id, date, overall_rating
                         FROM Player_Attributes WHERE overall_rating IS NOT NULL""", con)
print(r.shape)
r.to_csv("player_ratings.csv", index=False)
pd.read_sql_query("SELECT player_api_id, player_name FROM Player", con).to_csv("players.csv", index=False)