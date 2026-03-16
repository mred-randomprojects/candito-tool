# Tasks

1. Add a module for 1RM calculations, and show the estimate to the user. E.g. if they need to do 4 reps of 75kg, show that the estimate calculated 1RM is 81.8kg. Use the formulas used by https://strengthlevel.com/one-rep-max-calculator or completely HALT the operation and mention this isn't possible. Make this invisible by default, so that the user isn't spoiled, make it possible to click on an "eye" icon to hide/unhide the estimated 1RM.
2. Add a warm-up calculation, it should use an optimal algorithm to figure out the exact escalation sets to perform in order to be ready for the next series. It should label the sets "Warm up #1", "Warm up #2", and so on.
3. Let's add a way to also write down if I did more/less weight than required, since this could happen if there are no weights available.

[17:04, 3/12/2026] Maxi: - allow to make a workout read-only (locked away)

- ⁠allow a “go to today” that easily takes you to the closest unfinished workout today
- ⁠mark workouts in the past as “overdue”
- ⁠accessory lifts require you to input the weight done
- ⁠suggested weight for accessory lifts: take historical inputs and suggest from 80% to 110% of effort

4. Add navigation: whenever I open any new page, I want to make it so that when I hit CMD+R (browser refresh) the website stays in the same place! What are all the pages we have? Let's have a sub-route for them!
5. Make it possible to change the date of a workout in a session, slightly highlight the updated data and on tap show the updated reason (so also ask the user what was the reason for the date update).
6. Make the tool keep track of your weights in each accessory lift as well, so that I have a suggest weight to do there as well!
7. Make sure to save, not only when the user hits "save and exit", but actually as soon as we receive any input from the user.
